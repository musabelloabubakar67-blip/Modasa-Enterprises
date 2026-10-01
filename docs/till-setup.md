# Setting up a till PC

There are two ways to run the till. **Use the desktop app** (option A) on shop tills; it prints receipts
directly, opens the cash drawer, and locks the PC to the till. Option B (Chrome in kiosk mode) is a fallback
that needs no installation.

## You need

- Windows 10/11 PC or laptop
- 80 mm (or 58 mm) thermal receipt printer, with its Windows driver installed
- Optional: cash drawer plugged into the printer (RJ11 cable), USB barcode scanner
- A UPS for the PC, printer and router

## Receipt printer (both options)

1. Install the printer's Windows driver from the manufacturer (the CD or their website), then print a Windows
   test page from **Settings → Bluetooth & devices → Printers & scanners → (printer) → Print test page**.
2. Note the printer's name exactly as Windows shows it; you'll pick it in the till settings.

---

## Option A: Desktop till app (recommended)

### Install

Run **Retail Till_x.y.z_x64-setup.exe** (built from `desktop/`, see below) and follow the steps. It installs
for all users of the PC.

### First launch: till settings

The app opens its settings screen the first time:

| Setting | What to enter |
| --- | --- |
| Server address | The address of the retail system, e.g. `https://modasa.example.com` |
| Printer | The receipt printer's name. **Refresh** if you just plugged it in. *Test file* saves receipts to `Documents\till-test-receipt.txt` instead of printing (for testing without a printer). |
| Paper width | 80 mm (most printers) or 58 mm |
| Cash drawer | Tick if a drawer is plugged into the printer |
| Lock to the till | Tick on shop tills. Full screen; can't be closed with Alt+F4 or the taskbar. |
| Start with Windows | Tick on shop tills |
| Manager PIN | 4+ digits. Needed to leave the locked till or change settings. |

Click **Print a test page**: check it printed, the paper was cut, the drawer opened, and the line of digits
ends exactly at the right edge (if it wraps or stops short, the paper width is wrong). Then **Save and open
the till** and sign in with the cashier's account.

### Day to day

- Receipts print automatically after each sale; the drawer opens for cash sales.
- **Open drawer** (top of the till) is for giving change without a sale. It asks for a reason, and every
  opening is listed with that day's till session for the owner to review.
- Reprints from **Sales → the sale → Print receipt** are marked *** COPY ***.
- Links to other sites (e.g. *Send on WhatsApp*) open in the PC's normal browser, not inside the till.

### Keyboard shortcuts

| Keys | Does |
| --- | --- |
| Ctrl + Shift + S | Till settings (asks for the manager PIN when locked) |
| Ctrl + Shift + Q | Exit the till (asks for the manager PIN when locked) |

### Building the installer (developers)

Needs Rust and the Visual Studio C++ build tools (`winget install Rustlang.Rustup` and
`winget install Microsoft.VisualStudio.2022.BuildTools` with the C++ workload).

```bash
cd desktop
npm install
npm run build
```

The installer is written to `desktop/src-tauri/target/release/bundle/nsis/`. Settings live per PC in
`%APPDATA%\com.retailops.till\till-config.json`.

---

## Option B: Chrome in kiosk mode (no install)

Receipts print through Windows' print system, so set the printer up first:

1. **Settings → Printers & scanners**: turn **off** "Let Windows manage my default printer" and make the receipt
   printer the **default**.
2. In the printer's **Printing preferences**: paper size **80 mm roll**, **cut after document**, and set the cash
   drawer to open **after printing** (named *Cash Drawer*, *Peripheral* or *Kick-out* depending on the brand).
3. Create a desktop shortcut (one line):

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --user-data-dir="C:\TillProfile" https://YOUR-SITE/app/pos
   ```

   `--kiosk` is full screen; `--kiosk-printing` prints to the default printer with no dialog; `--user-data-dir`
   keeps the till's sign-in separate from personal browsing. Leave kiosk mode with **Alt + F4**.
4. To start it with Windows: **Windows + R** → `shell:startup` → copy the shortcut there.

Limits compared with the app: one printer only, the drawer opens on every receipt (not just cash), no
"Open drawer" button, and anyone who knows Alt+F4 can leave the till.

---

## Barcode scanner (both options)

Plug it in; it types like a keyboard. Scan a product label into the till's search box and the item should be
added straight away. If nothing happens until you press Enter, scan the "Add CR/Enter suffix" setup barcode in
the scanner's manual.

## Test before opening (both options)

Make a test sale, check the receipt and drawer, then return it from **Sales → the sale → Return items** so the
day's figures stay correct.

## Warehouse PCs (labels)

Warehouses print labels, not receipts: use normal Chrome (no kiosk) and choose the label printer in the print
dialog. For a thermal label printer, set its paper size to **50 × 30 mm** in its printing preferences and pick
"Label printer · 50 × 30 mm" on the Labels page.
