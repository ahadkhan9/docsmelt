/**
 * Forges minimal-but-valid sample files (docx, xlsx, epub, csv, rtf, pdf)
 * into samples/ for the smoke test and manual testing.
 * Run: node scripts/make-samples.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

mkdirSync("samples", { recursive: true });

// ── DOCX ────────────────────────────────────────────────────────────────
const docx = new JSZip();
docx.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
);
docx.file(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
);
docx.file(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Smelted sample</w:t></w:r></w:p>
<w:p><w:r><w:t>This document was forged in the docsmelt furnace.</w:t></w:r></w:p>
<w:p><w:r><w:t>Every page of it converts to clean markdown.</w:t></w:r></w:p>
</w:body></w:document>`,
);
writeFileSync("samples/sample.docx", await docx.generateAsync({ type: "nodebuffer" }));

// ── XLSX ────────────────────────────────────────────────────────────────
const xlsx = new JSZip();
xlsx.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
);
xlsx.file(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
);
xlsx.file(
  "xl/workbook.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Metals" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
);
xlsx.file(
  "xl/_rels/workbook.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
);
xlsx.file(
  "xl/worksheets/sheet1.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Metal</t></is></c><c r="B1" t="inlineStr"><is><t>Melts at °C</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>Iron</t></is></c><c r="B2"><v>1538</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>Gold</t></is></c><c r="B3"><v>1064</v></c></row>
</sheetData>
</worksheet>`,
);
writeFileSync("samples/sample.xlsx", await xlsx.generateAsync({ type: "nodebuffer" }));

// ── EPUB ────────────────────────────────────────────────────────────────
const epub = new JSZip();
epub.file("mimetype", "application/epub+zip", { compression: "STORE" });
epub.file(
  "META-INF/container.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
);
epub.file(
  "OEBPS/content.opf",
  `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">urn:uuid:docsmelt-sample-1</dc:identifier>
<dc:title>Smelted</dc:title>
</metadata>
<manifest><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="c1"/></spine>
</package>`,
);
epub.file(
  "OEBPS/chapter1.xhtml",
  `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body><h1>Smelted chapter</h1><p>Smelted sample paragraph.</p></body>
</html>`,
);
writeFileSync("samples/sample.epub", await epub.generateAsync({ type: "nodebuffer" }));

// ── CSV / RTF ───────────────────────────────────────────────────────────
writeFileSync("samples/sample.csv", "name,melts_at_c\nIron,1538\nGold,1064\n");
writeFileSync("samples/sample.rtf", String.raw`{\rtf1\ansi Some \b bold\b0 text in RTF.}`);

// ── PDF (hand-written, uncompressed streams, exact xref offsets) ────────
const content = "BT /F1 24 Tf 72 720 Td (Smelted sample PDF) Tj ET";
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let pdf = "%PDF-1.4\n";
const offsets = [];
for (let i = 0; i < objects.length; i += 1) {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
writeFileSync("samples/sample.pdf", pdf);

console.log("samples written:", ["sample.docx", "sample.xlsx", "sample.epub", "sample.csv", "sample.rtf", "sample.pdf"].join(", "));
