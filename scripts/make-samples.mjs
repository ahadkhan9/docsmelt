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

// ── Edge-case samples ────────────────────────────────────────────────────

// Empty-but-valid docx (no content) — engine must return empty markdown.
const emptyDocx = new JSZip();
emptyDocx.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
);
emptyDocx.file(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
);
emptyDocx.file(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>`,
);
writeFileSync("samples/sample-empty.docx", await emptyDocx.generateAsync({ type: "nodebuffer" }));

// Zero-byte file.
writeFileSync("samples/sample-zero.docx", Buffer.alloc(0));

// Truncated docx (valid magic, broken body).
writeFileSync("samples/sample-truncated.docx", (await import("node:fs")).readFileSync("samples/sample.docx").subarray(0, 24));

// Unsupported: a real 1×1 PNG.
writeFileSync(
  "samples/sample-unsupported.png",
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
);

// Scanned PDF: one page, image-only content stream (no text operators).
{
  const imgContent = "q 72 72 468 648 cm /Im0 Do Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>",
    `<< /Length ${imgContent.length} >>\nstream\n${imgContent}\nendstream`,
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\x00\nendstream",
  ];
  let scanned = "%PDF-1.4\n";
  const offsets = [];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(scanned.length);
    scanned += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = scanned.length;
  scanned += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) scanned += `${String(o).padStart(10, "0")} 00000 n \n`;
  scanned += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  writeFileSync("samples/sample-scanned.pdf", scanned);
}

// Minimal OLE compound file whose directory names a single stream.
// Enough for the engine's detection (stream-name probing) and for the
// encrypted path (probe_ole on EncryptedPackage).
function oleCfb(streamName) {
  const header = Buffer.alloc(512);
  header.writeUInt32LE(0xe011cfd0, 0); // OLE magic
  header.writeUInt32LE(0xe11ab1a1, 4);
  header.writeUInt16LE(0x003e, 24); // minor version
  header.writeUInt16LE(0x0003, 26); // major version
  header.writeUInt16LE(0xfffe, 28); // byte order
  header.writeUInt16LE(9, 30); // sector shift (512)
  header.writeUInt16LE(6, 32); // mini sector shift
  header.writeUInt32LE(1, 40); // directory sector count
  header.writeUInt32LE(1, 44); // FAT sector count
  header.writeUInt32LE(1, 48); // first directory sector
  header.writeUInt32LE(0, 52); // transaction signature
  header.writeUInt32LE(4096, 56); // mini stream cutoff
  header.writeUInt32LE(0xfffffffe, 60); // first miniFAT
  header.writeUInt32LE(0, 64); // miniFAT count
  header.writeUInt32LE(0xfffffffe, 68); // first DIFAT
  header.writeUInt32LE(0, 72); // DIFAT count
  header.writeUInt32LE(0, 76); // DIFAT[0] → FAT at sector 0
  for (let i = 80; i < 512; i += 4) header.writeUInt32LE(0xffffffff, i);
  const fat = Buffer.alloc(512);
  fat.writeUInt32LE(0xfffffffd, 0); // sector 0 = FAT itself
  fat.writeUInt32LE(0xfffffffe, 4); // sector 1 = directory, end of chain
  for (let i = 8; i < 512; i += 4) fat.writeUInt32LE(0xffffffff, i);
  const dir = Buffer.alloc(512);
  const nameAt = (buf, name, off) => Buffer.from(name, "utf16le").copy(buf, off);
  nameAt(dir, "Root Entry", 0);
  dir.writeUInt16LE(22, 64); // name length incl. null (10 chars ×2 + 2)
  dir[66] = 5; // root storage
  dir[67] = 1; // black
  dir.writeUInt32LE(0xffffffff, 68); // left
  dir.writeUInt32LE(0xffffffff, 72); // right
  dir.writeUInt32LE(1, 76); // child → entry 1
  dir.writeUInt32LE(0xfffffffe, 116); // start sector
  dir.writeUInt32LE(0, 120); // size (low 32)
  dir.writeUInt32LE(0, 124); // size (high 32)
  nameAt(dir, streamName, 128);
  dir.writeUInt16LE(streamName.length * 2 + 2, 128 + 64);
  dir[128 + 66] = 2; // stream
  dir.writeUInt32LE(0xffffffff, 128 + 68);
  dir.writeUInt32LE(0xffffffff, 128 + 72);
  dir.writeUInt32LE(0xffffffff, 128 + 76);
  dir.writeUInt32LE(0, 128 + 116); // start sector 0
  dir.writeUInt32LE(0, 128 + 120);
  dir.writeUInt32LE(0, 128 + 124);
  return Buffer.concat([header, fat, dir]);
}

// Encrypted-looking OOXML: detection returns undefined by design; the
// extension fallback + OLE probe land on the `encrypted` error.
writeFileSync("samples/sample-encrypted.docx", oleCfb("EncryptedPackage"));

// Legacy binary .doc: detection must identify the WordDocument stream.
writeFileSync("samples/sample-legacy.doc", oleCfb("WordDocument"));

// Docx with an embedded image → toDocument must return it as an asset.
{
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const imgDocx = new JSZip();
  imgDocx.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  imgDocx.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  imgDocx.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`,
  );
  imgDocx.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Ingot with image</w:t></w:r></w:p>
<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="914400" cy="914400"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
</w:body></w:document>`,
  );
  imgDocx.file("word/media/image1.png", png);
  writeFileSync("samples/sample-image.docx", await imgDocx.generateAsync({ type: "nodebuffer" }));
}

console.log(
  "samples written:",
  ["sample.docx", "sample.xlsx", "sample.epub", "sample.csv", "sample.rtf", "sample.pdf",
   "sample-empty.docx", "sample-zero.docx", "sample-truncated.docx", "sample-unsupported.png",
   "sample-scanned.pdf", "sample-encrypted.docx", "sample-image.docx",
   "sample-legacy.doc"].join(", "),
);
