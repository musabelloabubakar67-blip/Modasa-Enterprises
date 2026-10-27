import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";

export type Grid = unknown[][];

/**
 * Reads a .csv file, or an .xlsx file, as rows of cells. Browser only. A workbook may open on another tab (e.g.
 * "Read me"), so with `isWanted` the first sheet it accepts is used, otherwise the first sheet.
 */
export async function readGrid(file: File, isWanted?: (grid: Grid) => boolean): Promise<Grid> {
  if (/\.xlsx$/i.test(file.name)) {
    const sheets = await readXlsxFile(file);
    return (isWanted && sheets.find((s) => isWanted(s.data))?.data) || sheets[0]?.data || [];
  }
  if (/\.(csv|txt)$/i.test(file.name)) {
    const text = await file.text();
    // Keep blank lines so row numbers match what people see in Excel; empty rows are skipped later.
    const result = Papa.parse<string[]>(text.replace(/^﻿/, ""));
    return result.data;
  }
  throw new Error("Choose a .csv or .xlsx file. (Old .xls files: open in Excel and save as .xlsx first.)");
}
