import JSZip from 'jszip';
import {writeFile} from 'node:fs/promises';
const zip=new JSZip();
zip.file('ppt/presentation.xml','<p:presentation xmlns:p="urn:p" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="r1"/><p:sldId r:id="r2"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>');
zip.file('ppt/_rels/presentation.xml.rels','<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>');
for(let i=1;i<=2;i++)zip.file(`ppt/slides/slide${i}.xml`,`<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="600000" y="1000000"/><a:ext cx="7900000" cy="2000000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:rPr sz="3600" b="1"/><a:t>Folio slide preview ${i}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
await writeFile('tests/fixtures/Preview_Slides.pptx',await zip.generateAsync({type:'nodebuffer'}));
