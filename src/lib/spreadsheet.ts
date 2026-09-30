import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";

export type Grid = unknown[][];

/** Reads the first sheet of an .xlsx file, or a .csv file, as rows of cells. Browser only. */
export async function readGrid(file: File): Promise<Grid> {
  if (/\.xlsx$/i.test(file.name)) return readSheet(file);
  if (/\.(csv|txt)$/i.test(file.name)) {
    const text = await file.text();
    // Keep blank lines so row numbers match what people see in Excel; empty rows are skipped later.
    const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""));
    return result.data;
  }
  throw new Error("Choose a .csv or .xlsx file. (Old .xls files: open in Excel and save as .xlsx first.)");
}
