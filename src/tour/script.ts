/**
 * THE DEMO TOUR SCRIPT. Rewrite the lines or the steps here; nothing else needs to change.
 *
 * Mo presents the app while it is used for real, on the local demo data from `npm run demo:reset`.
 * Each scene starts by signing in the right person off camera, so any scene can be started on its own:
 *   http://localhost:3000/login?tour=1                 the whole tour (press Enter to start)
 *   http://localhost:3000/login?tour=1&scene=labels    from that scene on
 * Space pauses, Esc stops. Scene ids: welcome, open, sale, till-extras, exchange, close, product, import,
 * delivery, stock, count, labels, reports, goodbye. Run `npm run demo:reset` before each full take.
 *
 * Steps (see steps.ts):
 *   say("…", { spotlight: "name" })   Mo talks; optionally highlights a part of the screen
 *   click("name", { match: "words" }) the cursor clicks it (match picks the one with those words)
 *   type("name", "text", { clear: true })
 *   typeFrom("name", "source", { adjust: -500 })   types the amount shown in "source", plus adjust
 *   choose("name", "Option label")     a dropdown
 *   press("name")                      Enter in that field (sends a search form)
 *   upload("name", "product-workbook") chooses the demo workbook in a file picker
 *   when("name", [steps])              those steps only if "name" is on the page
 *   goto("/app/…"), wait(ms), waitFor("name"), wave(), signInAs("kemi")
 * "name" is a data-tour="…" attribute on the page (search the code for data-tour to see them all).
 *
 * The data the lines talk about (from scripts/demo-setup.mjs and the seed):
 *   Kemi Adebayo, owner · Ada Nwosu (PIN 2580) and Bisi Lawal, cashiers at Shop 1
 *   Amaka Obi, 0803 555 0142, bought a Centre Rug – Turkey 4 × 6 (₦70,000) yesterday at Shop 1
 *   Shop 1 has 1 laundry basket left (reorder level 3); Warehouse B has 30
 *   Shop 1 has no Vinyl Floor Tiles (Warehouse B and Shop 2 do); it has 1 Knife Set (6 pcs) on record
 *   The workbook upload adds Duvet Set (Double, King) in a new Bedding category, and Table Runner (Gold, Silver)
 */
import {
  choose,
  click,
  goto,
  press,
  say,
  scene,
  signInAs,
  type,
  typeFrom,
  upload,
  wait,
  waitFor,
  wave,
  when,
  type Pace,
  type Step,
} from "./steps";

export const pace: Pace = {
  charsPerSecond: 32,
  minReadMs: 1800,
  readMsPerChar: 32,
  cursorMs: 800,
  typingMs: 75,
  afterActionMs: 800,
};

/** If a scene is started on its own before the till was opened, open it quietly so the scene can go ahead. */
const openTillIfClosed: Step = when("open-float", [type("open-float", "10000"), click("open-till")]);

export const scenes = [
  scene("welcome", "Welcome and overview", [
    signInAs("kemi"),
    goto("/app"),
    waitFor("dash-today"),
    wave(),
    say("Hello! I'm Mo. Let me show you how Modasa runs its shops and warehouses from one screen."),
    say("This is the owner's home page. Today's sales across every shop, live as they happen.", {
      spotlight: "dash-today",
    }),
    say("Each shop at a glance: how many sales, the takings, and whether the till is open.", {
      spotlight: "dash-shops",
    }),
    say("And anything waiting for you, like transfers to send or items running low.", {
      spotlight: "dash-attention",
    }),
    say("It's the start of the day and no till is open yet. Let's open Shop 1.", { spotlight: "nav" }),
  ]),

  scene("open", "Opening the till and switching cashier", [
    signInAs("kemi"),
    goto("/app/pos"),
    click("pos-shop", { match: "Shop 1" }),
    when("open-float", [
      say("Every day starts by counting the cash already in the drawer, called the float.", {
        spotlight: "open-float",
      }),
      type("open-float", "10000"),
      say("Ten thousand naira. At closing time the till compares the count with this.", {
        spotlight: "open-float",
      }),
      click("open-till"),
    ]),
    waitFor("till-header"),
    say("The till is open. Several people share it, and each sale should be recorded under whoever makes it.", {
      spotlight: "till-header",
    }),
    say("So nobody shares a login. A tap on Switch cashier hands the till over.", { spotlight: "switch-cashier" }),
    click("switch-cashier"),
    waitFor("lock-people"),
    say("Everyone who can use this till is listed. Ada is on shift, so she taps her name.", {
      spotlight: "lock-people",
    }),
    click("lock-people", { match: "Ada Nwosu" }),
    waitFor("pin-pad"),
    say("Then her own four-digit PIN. It takes about three seconds."),
    click("pin-pad", { match: "2" }),
    click("pin-pad", { match: "5" }),
    click("pin-pad", { match: "8" }),
    click("pin-pad", { match: "0" }),
    waitFor("till-header"),
    say("Ada is in. A PIN only opens the till, and it locks itself after two minutes of quiet.", {
      spotlight: "whoami",
    }),
  ]),

  scene("sale", "Making a sale", [
    signInAs("ada"),
    goto("/app/pos"),
    openTillIfClosed,
    waitFor("sku-search"),
    say("A customer wants a shaggy rug and a set of dishes. Ada scans them, or types a few letters.", {
      spotlight: "sku-search",
    }),
    type("sku-search", "shaggy", { clear: true }),
    waitFor("sku-results", { match: "CRUG-005" }),
    click("sku-results", { match: "CRUG-005" }),
    type("sku-search", "dishes", { clear: true }),
    waitFor("sku-results", { match: "T3-14G" }),
    click("sku-results", { match: "T3-14G" }),
    say("Prices come from the catalogue, so there's no guessing at the counter.", { spotlight: "cart" }),
    type("customer-phone", "0812 345 6789"),
    type("customer-name", "Tolu Bakare"),
    say("A phone number saves the customer, so next time her name fills in by itself.", { spotlight: "customer" }),
    say("She's a regular, so Ada gives five percent off. The owner sets a limit for each person.", {
      spotlight: "checkout",
    }),
    click("add-discount"),
    type("discount-value", "5"),
    type("discount-reason", "Regular customer"),
    say("A reason is required, and every discount shows up in the staff report.", { spotlight: "discount" }),
    click("charge"),
    waitFor("pay-amount-0"),
    say("Tolu pays fifty thousand in cash and the rest by bank transfer."),
    type("pay-amount-0", "50000", { clear: true }),
    type("pay-tendered-0", "60000"),
    say("She hands over sixty thousand, and the till works out her change.", { spotlight: "pay-change-0" }),
    click("split-payment"),
    waitFor("pay-ref-1"),
    type("pay-ref-1", "Tolu Bakare"),
    say("The payments must add up to the total exactly, so the till always balances.", { spotlight: "checkout" }),
    click("complete-sale"),
    waitFor("sale-complete"),
    say("Done. The stock has already come off Shop 1, and the receipt can be printed or sent on WhatsApp.", {
      spotlight: "sale-complete",
    }),
    click("new-sale"),
  ]),

  scene("till-extras", "Out of stock, deliveries and collections", [
    signInAs("ada"),
    goto("/app/pos"),
    openTillIfClosed,
    waitFor("sku-search"),
    say("Next, a customer asks for brown vinyl floor tiles."),
    type("sku-search", "VL-68001", { clear: true }),
    waitFor("sku-results", { match: "VL-68001" }),
    click("sku-results", { match: "VL-68001" }),
    waitFor("not-in-stock"),
    say("Shop 1 has none, but the till shows where they are, and one tap asks for them to be sent over.", {
      spotlight: "not-in-stock",
    }),
    click("not-in-stock-dismiss"),
    say("Now a centre table, to be delivered to the customer's home."),
    type("sku-search", "centre table", { clear: true }),
    waitFor("sku-results", { match: "16395-9" }),
    click("sku-results", { match: "16395-9" }),
    type("customer-phone", "0809 876 5432"),
    type("customer-name", "Ngozi Ibe"),
    click("handover", { match: "Delivery" }),
    type("delivery-address", "14 Bourdillon Road"),
    type("delivery-area", "Ikoyi"),
    type("delivery-fee", "5000"),
    say("The address and the delivery fee go on the sale. Collect later works the same way.", {
      spotlight: "checkout",
    }),
    click("charge"),
    waitFor("payment-0"),
    click("payment-0", { match: "Bank transfer" }),
    type("pay-ref-0", "Ngozi Ibe"),
    click("complete-sale"),
    waitFor("sale-complete"),
    click("new-sale"),
    goto("/app/sales/pending"),
    waitFor("pending-list", { match: "Ngozi Ibe" }),
    say("Everything waiting to be collected or delivered is listed here, so nothing is forgotten.", {
      spotlight: "pending-list",
      match: "Ngozi Ibe",
    }),
    click("pending-list", { match: "Out for delivery" }),
    wait(1500),
    say("When the driver leaves, Ada marks it out for delivery, and delivered once it arrives.", {
      spotlight: "pending-list",
      match: "Ngozi Ibe",
    }),
  ]),

  scene("exchange", "An exchange", [
    signInAs("ada"),
    goto("/app/pos"),
    openTillIfClosed,
    goto("/app/sales"),
    waitFor("sale-search"),
    say("Yesterday Amaka bought a rug. It's too small, and she's back to change it.", {
      spotlight: "sale-search",
    }),
    type("sale-search", "08035550142", { clear: true }),
    press("sale-search"),
    waitFor("sales-list", { match: "Amaka Obi" }),
    say("Her phone number finds the sale, no paper receipt needed.", { spotlight: "sales-list" }),
    click("sales-list", { match: "Amaka Obi" }),
    waitFor("exchange-items"),
    say("Any past sale can be opened like this, and its receipt printed again or resent on WhatsApp.", {
      spotlight: "receipt-actions",
    }),
    click("exchange-items"),
    waitFor("return-qty-0"),
    type("return-qty-0", "1", { clear: true }),
    type("return-reason", "Too small for her living room"),
    say("Modasa doesn't give cash refunds. The rug becomes credit towards something of equal or higher value.", {
      spotlight: "return-credit",
    }),
    click("continue-to-till"),
    waitFor("exchange-banner"),
    say("Back at the till, the credit is waiting.", { spotlight: "exchange-banner" }),
    type("sku-search", "turkey", { clear: true }),
    waitFor("sku-results", { match: "CRUG-003" }),
    click("sku-results", { match: "CRUG-003" }),
    say("She picks the bigger five by seven, on offer at a hundred and twenty thousand.", { spotlight: "cart" }),
    say("So she only tops up the difference.", { spotlight: "charge" }),
    click("charge"),
    waitFor("payment-0"),
    click("payment-0", { match: "Bank transfer" }),
    type("pay-ref-0", "Amaka Obi"),
    click("complete-sale"),
    waitFor("sale-complete"),
    say("Exchanged. The small rug is back in stock and the books balance to the naira.", {
      spotlight: "sale-complete",
    }),
    click("new-sale"),
  ]),

  scene("close", "Closing the till", [
    signInAs("ada"),
    goto("/app/pos"),
    openTillIfClosed,
    waitFor("close-till"),
    say("At the end of the day, Ada closes the till.", { spotlight: "close-till" }),
    click("close-till"),
    waitFor("close-expected"),
    say("The system already knows what there should be, for cash, card and transfers.", {
      spotlight: "close-expected",
    }),
    say("Ada counts every note in the drawer, then checks the transfers in the bank app."),
    typeFrom("count-cash", "expected-cash", { adjust: -500 }),
    typeFrom("count-transfer", "expected-transfer"),
    say("The transfers match, but the cash is five hundred naira short. The till shows it straight away.", {
      spotlight: "close-form",
    }),
    type("close-note", "₦500 short, checking the float with Bisi"),
    say("Anything that doesn't match needs a note, and the owner will see it.", { spotlight: "close-note" }),
    click("close-submit"),
    wait(3000),
    say("The day is closed. Every till session is kept, with who closed it and any difference."),
  ]),

  scene("product", "Adding a product", [
    signInAs("kemi"),
    goto("/app/products"),
    waitFor("new-product"),
    say("Back in the office. New items can be added one at a time from Products.", { spotlight: "new-product" }),
    click("new-product"),
    waitFor("product-name"),
    type("product-name", "Bath Towel Set"),
    choose("product-category", "Home Essentials"),
    choose("product-unit", "Set"),
    type("product-description", "Soft cotton bath and hand towels."),
    say("A name, a category and how it's sold: by the piece, the set, the roll or the box.", {
      spotlight: "product-unit",
    }),
    say("Each colour or size with its own price is an SKU, with its own code.", { spotlight: "sku-0" }),
    type("sku-0-code", "BTS-GRY"),
    type("sku-0-variant", "Grey"),
    type("sku-0-price", "12500"),
    type("sku-0-cost", "7000"),
    say("The cost price is hidden from cashiers, and the margin is worked out as you type.", {
      spotlight: "sku-0",
    }),
    click("add-sku"),
    waitFor("sku-1-code"),
    type("sku-1-code", "BTS-CRM"),
    type("sku-1-variant", "Cream"),
    type("sku-1-price", "12500"),
    type("sku-1-cost", "7000"),
    click("product-save"),
    waitFor("product-photos"),
    say("Created. Photos are added here, and they show at the till and on the website.", {
      spotlight: "product-photos",
    }),
  ]),

  scene("import", "Importing the product workbook", [
    signInAs("kemi"),
    goto("/app/products/import"),
    waitFor("download-workbook"),
    say("For many items at once, there's the product workbook.", { spotlight: "download-workbook" }),
    say("Download it, fill in one row per item in Excel, then upload the same file here."),
    upload("import-file", "product-workbook"),
    waitFor("import-summary"),
    say("Nothing is saved yet. The preview counts the new products, flags any mistakes, and lists new categories.", {
      spotlight: "import-summary",
    }),
    click("import-run"),
    waitFor("import-done"),
    say("Imported. Duvet sets and table runners are in the catalogue, under a new Bedding category.", {
      spotlight: "import-done",
    }),
    say("The same workbook's count columns can then set the opening stock for every location."),
  ]),

  scene("delivery", "Receiving a delivery", [
    signInAs("kemi"),
    goto("/app/stock/deliveries"),
    waitFor("new-delivery"),
    say("When goods arrive from a supplier, the warehouse records the delivery.", { spotlight: "new-delivery" }),
    click("new-delivery"),
    waitFor("delivery-warehouse"),
    choose("delivery-warehouse", "Warehouse A"),
    type("delivery-supplier", "Lagos Home Textiles"),
    type("delivery-invoice", "LHT-2231"),
    type("sku-search", "BTS-GRY", { clear: true }),
    waitFor("sku-results", { match: "BTS-GRY" }),
    click("sku-results", { match: "BTS-GRY" }),
    type("sku-search", "BTS-CRM", { clear: true }),
    waitFor("sku-results", { match: "BTS-CRM" }),
    click("sku-results", { match: "BTS-CRM" }),
    type("delivery-qty-0", "20", { clear: true }),
    type("delivery-cost-0", "7000", { clear: true }),
    type("delivery-qty-1", "20", { clear: true }),
    type("delivery-cost-1", "7000", { clear: true }),
    say("What came in and what it cost. The cost becomes each item's cost price.", {
      spotlight: "delivery-lines",
    }),
    click("post-delivery"),
    wait(3000),
    say("Posted. Forty towel sets are now in Warehouse A, ready to send to the shops."),
  ]),

  scene("stock", "Stock and transfers", [
    signInAs("kemi"),
    goto("/app/stock"),
    waitFor("stock-values"),
    say("Kemi can see the stock in every shop and warehouse, valued at cost.", {
      spotlight: "stock-values",
    }),
    type("stock-search", "laundry", { clear: true }),
    press("stock-search"),
    waitFor("stock-table", { match: "Laundry Basket" }),
    say("Shop 1 is down to its last laundry basket. Red means it's below the reorder level.", {
      spotlight: "stock-table",
      match: "Laundry Basket",
    }),
    say("Warehouse B has thirty, so she asks for five to be sent over."),
    goto("/app/transfers/new"),
    waitFor("transfer-from"),
    choose("transfer-from", "Warehouse B"),
    choose("transfer-to", "Shop 1"),
    type("sku-search", "laundry", { clear: true }),
    waitFor("sku-results", { match: "LX21-KC12S" }),
    click("sku-results", { match: "LX21-KC12S" }),
    type("transfer-qty-0", "5", { clear: true }),
    type("transfer-note", "Shop 1 is running low"),
    click("create-transfer"),
    wait(2500),
    say("The warehouse sees the request straight away. Shop 1 confirms what arrives, so nothing goes missing."),
  ]),

  scene("count", "Stock counts and history", [
    signInAs("kemi"),
    goto("/app/stock/adjustments"),
    waitFor("new-count"),
    say("Regular stock counts keep the numbers honest.", { spotlight: "new-count" }),
    click("new-count"),
    waitFor("adjust-location"),
    choose("adjust-location", "Shop 1"),
    type("adjust-note", "Weekly count, kitchen shelf"),
    type("sku-search", "528-2B", { clear: true }),
    waitFor("sku-results", { match: "528-2B" }),
    click("sku-results", { match: "528-2B" }),
    type("adjust-qty-0", "3", { clear: true }),
    say("Shop 1 found three knife sets on the shelf. Only the items listed change, and the difference is recorded.", {
      spotlight: "adjust-lines",
    }),
    click("adjust-submit"),
    wait(3000),
    say("A cashier's count waits for a manager to approve it. The owner's own count applies straight away."),
    goto("/app/stock/history"),
    waitFor("movements"),
    say(
      "Every change to stock, from sales and deliveries to counts and transfers, is in the history, with who did it.",
      {
        spotlight: "movements",
      },
    ),
  ]),

  scene("labels", "Printing labels", [
    signInAs("kemi"),
    goto("/app/stock/labels"),
    waitFor("label-settings"),
    say("The new towel sets need price labels.", { spotlight: "label-settings" }),
    type("sku-search", "BTS-GRY", { clear: true }),
    waitFor("sku-results", { match: "BTS-GRY" }),
    click("sku-results", { match: "BTS-GRY" }),
    type("sku-search", "BTS-CRM", { clear: true }),
    waitFor("sku-results", { match: "BTS-CRM" }),
    click("sku-results", { match: "BTS-CRM" }),
    type("label-copies-0", "6", { clear: true }),
    type("label-copies-1", "6", { clear: true }),
    say("Pick the sticker sheet, how many of each, and whether to show the price.", {
      spotlight: "label-settings",
    }),
    say("What you see is exactly what prints, with a barcode on every label.", { spotlight: "label-preview" }),
    click("print-labels"),
    say("Print sends the sheet to any printer. At the till, scanning a label adds the item to the sale."),
  ]),

  scene("reports", "Reports", [
    signInAs("kemi"),
    goto("/app/reports"),
    waitFor("report-totals"),
    say("Reports turn all of this into answers. Net sales, number of sales and the average sale, for any dates.", {
      spotlight: "report-totals",
    }),
    click("tabs", { match: "Staff" }),
    waitFor("staff-report"),
    say("And who sold what. Ada's sales, her discount, the exchange and the cash shortfall are already here.", {
      spotlight: "staff-report",
      match: "Ada Nwosu",
    }),
    say("Discounts, exchanges and cash differences, person by person. No surprises at the end of the month.", {
      spotlight: "staff-report",
    }),
  ]),

  scene("goodbye", "Goodbye", [
    signInAs("kemi"),
    goto("/app"),
    waitFor("dash-shops"),
    say("And back home, Shop 1's day is already on the board.", { spotlight: "dash-shops" }),
    wave(),
    say("That's Modasa: selling, stock and reports in one place. Thanks for watching!"),
  ]),
];
