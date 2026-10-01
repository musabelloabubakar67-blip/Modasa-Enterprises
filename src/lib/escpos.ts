// ESC/POS: the command language thermal receipt printers understand. The desktop app sends these bytes
// straight to the printer, so receipts print instantly with no dialog, get cut, and can open the drawer.

const ESC = 0x1b;
const GS = 0x1d;

/** Characters per line in the printer's normal font: 80 mm paper = 48, 58 mm paper = 32. */
export type PaperWidth = 48 | 32;

export class EscPos {
  private bytes: number[] = [ESC, 0x40]; // initialise

  constructor(readonly width: PaperWidth) {}

  /**
   * Thermal printers' built-in fonts are plain ASCII, so characters like ₦ and curly quotes are
   * replaced with close equivalents rather than printing as garbage.
   */
  static ascii(text: string) {
    return text
      .replace(/₦/g, "N")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/×/g, "x")
      .replace(/…/g, "...")
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "");
  }

  text(line = "") {
    for (const ch of EscPos.ascii(line)) this.bytes.push(ch.charCodeAt(0));
    this.bytes.push(0x0a);
    return this;
  }

  align(where: "left" | "center" | "right") {
    this.bytes.push(ESC, 0x61, where === "left" ? 0 : where === "center" ? 1 : 2);
    return this;
  }

  bold(on: boolean) {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  /** Double width and height, for the business name and total. Halves characters per line. */
  big(on: boolean) {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  rule(char = "-") {
    return this.text(char.repeat(this.width));
  }

  /** Label on the left, value on the right, e.g. "TOTAL ........ N24,500". */
  row(left: string, right: string, width: number = this.width) {
    const l = EscPos.ascii(left);
    const r = EscPos.ascii(right);
    const space = width - l.length - r.length;
    if (space >= 1) return this.text(l + " ".repeat(space) + r);
    // Too long for one line: wrap the label, value on its own line.
    return this.wrap(l).text(" ".repeat(Math.max(0, width - r.length)) + r);
  }

  /** Word-wraps long text to the paper width. */
  wrap(text: string, width: number = this.width) {
    const words = EscPos.ascii(text).split(/\s+/);
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > width) {
        if (line) this.text(line);
        line = word.slice(0, width);
      } else line = (line + " " + word).trim();
    }
    if (line) this.text(line);
    return this;
  }

  /** CODE128 barcode, e.g. of the receipt number so returns can be scanned. */
  barcode(data: string) {
    const d = EscPos.ascii(data);
    this.bytes.push(GS, 0x68, 60); // height
    this.bytes.push(GS, 0x77, 2); // module width
    this.bytes.push(GS, 0x48, 2); // print the text below
    this.bytes.push(GS, 0x6b, 73, d.length + 2, 0x7b, 0x42); // CODE128, code set B
    for (const ch of d) this.bytes.push(ch.charCodeAt(0));
    this.bytes.push(0x0a);
    return this;
  }

  feed(lines = 1) {
    this.bytes.push(ESC, 0x64, lines);
    return this;
  }

  /** Feed past the tear bar and cut (partial cut, which most printers support). */
  cut() {
    this.bytes.push(GS, 0x56, 0x42, 0x03);
    return this;
  }

  /** Pulse the cash drawer port (pin 2), which pops the drawer open. */
  openDrawer() {
    this.bytes.push(ESC, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  toBytes() {
    return Uint8Array.from(this.bytes);
  }
}
