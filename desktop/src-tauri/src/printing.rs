//! Sending raw ESC/POS bytes to an installed Windows printer, bypassing the printer driver's page
//! layout. This is what makes receipts print instantly with no dialog, cut, and open the drawer.

/// Pseudo-printer that writes to Documents instead of printing, for testing without hardware.
pub const FILE_PRINTER: &str = "__file__";

#[cfg(windows)]
mod imp {
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW, StartDocPrinterW,
        StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
        PRINTER_INFO_4W,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn list() -> Result<Vec<String>, String> {
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut needed = 0u32;
        let mut count = 0u32;
        unsafe {
            // First call asks how big the buffer must be.
            let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut needed, &mut count);
            if needed == 0 {
                return Ok(vec![]);
            }
            let mut buf = vec![0u8; needed as usize];
            EnumPrintersW(flags, PCWSTR::null(), 4, Some(&mut buf), &mut needed, &mut count)
                .map_err(|e| format!("Couldn't list printers: {e}"))?;
            let infos = std::slice::from_raw_parts(buf.as_ptr() as *const PRINTER_INFO_4W, count as usize);
            Ok(infos
                .iter()
                .filter_map(|i| i.pPrinterName.to_string().ok())
                .collect())
        }
    }

    pub fn print(printer: &str, data: &[u8]) -> Result<(), String> {
        let name = wide(printer);
        let mut doc_name = wide("Receipt");
        let mut datatype = wide("RAW");
        unsafe {
            let mut handle = HANDLE::default();
            OpenPrinterW(PCWSTR(name.as_ptr()), &mut handle, None)
                .map_err(|e| format!("Couldn't open printer \"{printer}\": {e}"))?;

            let result = (|| {
                let doc = DOC_INFO_1W {
                    pDocName: PWSTR(doc_name.as_mut_ptr()),
                    pOutputFile: PWSTR::null(),
                    pDatatype: PWSTR(datatype.as_mut_ptr()),
                };
                if StartDocPrinterW(handle, 1, &doc) == 0 {
                    return Err("The printer refused the job. Is it switched on and connected?".to_string());
                }
                let mut ok = StartPagePrinter(handle).as_bool();
                let mut written = 0u32;
                ok = ok
                    && WritePrinter(handle, data.as_ptr() as *const _, data.len() as u32, &mut written).as_bool()
                    && written as usize == data.len();
                let _ = EndPagePrinter(handle);
                let _ = EndDocPrinter(handle);
                if ok {
                    Ok(())
                } else {
                    Err("Printing failed part-way. Check the paper and the printer cable.".to_string())
                }
            })();

            let _ = ClosePrinter(handle);
            result
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn list() -> Result<Vec<String>, String> {
        Ok(vec![])
    }
    pub fn print(_printer: &str, _data: &[u8]) -> Result<(), String> {
        Err("Direct printing is only supported on Windows.".into())
    }
}

pub fn list_printers() -> Result<Vec<String>, String> {
    let mut printers = imp::list()?;
    printers.sort();
    Ok(printers)
}

/// Prints to the named printer, or to a file in Documents for the test pseudo-printer.
pub fn print_raw(printer: &str, data: &[u8], documents: Option<std::path::PathBuf>) -> Result<(), String> {
    if printer == FILE_PRINTER {
        let dir = documents.ok_or("Couldn't find the Documents folder")?;
        let path = dir.join("till-test-receipt.bin");
        std::fs::write(&path, data).map_err(|e| format!("Couldn't write {}: {e}", path.display()))?;
        // A readable preview alongside: printable text only, control codes stripped.
        let preview = render_preview(data);
        let _ = std::fs::write(dir.join("till-test-receipt.txt"), preview);
        return Ok(());
    }
    imp::print(printer, data)
}

/// Renders ESC/POS bytes as plain text (what would appear on paper), marking cuts and drawer pulses.
pub fn render_preview(data: &[u8]) -> String {
    let mut out = String::new();
    let mut i = 0;
    while i < data.len() {
        match data[i] {
            0x1b => {
                // ESC commands: @ (init, 1 byte), a/E/d (1 arg), p (3 args)
                match data.get(i + 1) {
                    Some(b'@') => i += 2,
                    Some(b'p') => {
                        out.push_str("[DRAWER OPENS]\n");
                        i += 5;
                    }
                    Some(b'd') => {
                        for _ in 0..*data.get(i + 2).unwrap_or(&0) {
                            out.push('\n');
                        }
                        i += 3;
                    }
                    _ => i += 3,
                }
            }
            0x1d => match data.get(i + 1) {
                Some(b'V') => {
                    out.push_str("[CUT]\n");
                    i += 4;
                }
                Some(b'k') => {
                    let len = *data.get(i + 3).unwrap_or(&0) as usize;
                    let code: String = data
                        .get(i + 6..i + 4 + len)
                        .unwrap_or(&[])
                        .iter()
                        .map(|&b| b as char)
                        .collect();
                    out.push_str(&format!("[BARCODE {code}]\n"));
                    i += 4 + len;
                }
                _ => i += 3,
            },
            b'\n' => {
                out.push('\n');
                i += 1;
            }
            b if (0x20..0x7f).contains(&b) => {
                out.push(b as char);
                i += 1;
            }
            _ => i += 1,
        }
    }
    out
}

/// A short test page that proves the printer, cutter and drawer all work.
pub fn test_page(width: u8, drawer: bool) -> Vec<u8> {
    let mut b: Vec<u8> = vec![0x1b, b'@', 0x1b, b'a', 1, 0x1d, b'!', 0x11];
    b.extend_from_slice(b"TEST PRINT\n");
    b.extend_from_slice(&[0x1d, b'!', 0]);
    b.extend_from_slice(format!("{}\n", "-".repeat(width as usize)).as_bytes());
    b.extend_from_slice(b"If you can read this, the till\ncan print receipts.\n");
    b.extend_from_slice(format!("Paper width: {} characters\n", width).as_bytes());
    b.extend_from_slice(b"The full line below should end\nexactly at the right edge:\n");
    b.extend_from_slice(format!("{}\n", &"0123456789".repeat(5)[..width as usize]).as_bytes());
    b.extend_from_slice(&[0x1b, b'd', 4, 0x1d, b'V', 0x42, 3]);
    if drawer {
        b.extend_from_slice(&[0x1b, b'p', 0, 0x19, 0xfa]);
    }
    b
}
