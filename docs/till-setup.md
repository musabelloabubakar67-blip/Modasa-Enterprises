# Setting up a till PC

How to set up a shop's Windows PC so the till runs full-screen, locked to the POS, and prints receipts
without a print dialog. About 20 minutes per till.

## You need

- Windows PC or laptop with Google Chrome
- 80 mm thermal receipt printer (USB), with its Windows driver installed
- Optional: cash drawer plugged into the printer (RJ11), USB barcode scanner
- A UPS for the PC, printer and router

## 1. Receipt printer

1. Install the printer's Windows driver from the manufacturer (the CD or their website), then print a Windows
   test page.
2. **Settings → Bluetooth & devices → Printers & scanners** → turn **off** "Let Windows manage my default
   printer", then choose the receipt printer → **Set as default**.
3. Open the printer's **Printing preferences**:
   - Paper size: **80 mm × receipt** (sometimes called "80(72.1) × 297 mm" or "Roll paper 80 mm").
   - Cutting: **cut after document** (if it has an auto-cutter).
   - **Cash drawer**: set "open drawer" to **before/after printing** (option names vary by brand: *Cash
     Drawer*, *Peripheral*, *Kick-out*). The drawer then opens every time a receipt prints.

## 2. Chrome shortcut in kiosk mode

1. Right-click the desktop → **New → Shortcut**. For the location, paste (one line):

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --user-data-dir="C:\TillProfile" https://YOUR-SITE/app/pos
   ```

   - `--kiosk` full screen with no address bar or tabs.
   - `--kiosk-printing` prints straight to the default printer, no dialog.
   - `--user-data-dir` a separate Chrome profile just for the till, so it stays signed in and doesn't mix
     with anyone's personal browsing.
2. Name it **Till**.
3. Double-click it, sign in with the cashier's account, and open the till.

To leave kiosk mode (e.g. for maintenance): **Alt + F4**.

## 3. Start the till automatically

Press **Windows + R**, type `shell:startup`, press Enter, and copy the **Till** shortcut into that folder.
The till now opens when the PC starts.

## 4. Barcode scanner

Plug it in. It types like a keyboard, so there is nothing to install. Test by scanning a product label into
the till's search box; the item should be added straight away. If the scanner doesn't press Enter after the
code, scan the "Add CR suffix" / "Enter" setup barcode in its manual.

## 5. Test before opening

- Make a test sale and check the receipt prints **without a dialog**, the paper is cut, and the drawer opens.
- If the receipt is tiny or has large margins, re-check the paper size in step 1.3.
- Return the test sale from **Sales → the sale → Return items** so the day's figures stay correct.

## Warehouse PCs (labels)

Warehouse PCs print labels, not receipts, so use normal Chrome (no `--kiosk-printing`) and choose the label
printer in the print dialog. For a thermal label printer, set its paper size to **50 × 30 mm** in its printing
preferences and pick "Label printer · 50 × 30 mm" on the Labels page.
