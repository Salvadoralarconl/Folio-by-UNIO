import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';
const pdf = await PDFDocument.create();
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const serif = await pdf.embedFont(StandardFonts.TimesRoman);
const ink = rgb(.20,.24,.20), muted = rgb(.45,.50,.43), faint = rgb(.83,.86,.80), accent = rgb(.42,.49,.39);
const pages = [
  ['Project Proposal','Website Redesign & Development'],
  ['Our approach','Clarity at every step.'],
  ['Project timeline','Good work takes a little planning.'],
  ['Investment & next steps','A thoughtful foundation for what comes next.']
];
for(let index=0;index<pages.length;index++) {
  const page = pdf.addPage([612,792]);
  const text = (value,x,y,size=10,font=regular,color=ink) => page.drawText(value,{x,y,size,font,color});
  const line = (y) => page.drawLine({start:{x:55,y},end:{x:557,y},thickness:.6,color:faint});
  page.drawSvgPath('M 12 0 L 24 7 L 24 21 L 12 28 L 0 21 L 0 7 Z',{x:56,y:741,borderColor:accent,borderWidth:1.8});
  text('ACME STUDIO',96,728,11,bold); text('Considered design. Lasting impact.',96,712,8,regular,muted);
  text('PROPOSAL  /  2026-0415',438,731,7,regular,muted); text('April 15, 2026',496,716,8,regular,muted);
  page.drawLine({start:{x:55,y:657},end:{x:93,y:657},thickness:3,color:accent});
  text(pages[index][0],55,617,32,serif); text(pages[index][1],55,590,13,regular,muted);
  if(index===0) {
    text('PREPARED FOR',55,539,7,bold,muted); text('PREPARED BY',326,539,7,bold,muted);
    ['John Smith','Marketing Director','TechNova Inc.','123 Innovation Drive','San Francisco, CA 94107'].forEach((v,i)=>text(v,55,519-i*15,9));
    ['Emily Johnson','Business Development Manager','Acme Studio','456 Business Park','San Francisco, CA 94108'].forEach((v,i)=>text(v,326,519-i*15,9));
    line(433); text('Project overview',55,405,12,bold,accent);
    ['A fresh perspective for TechNova. We are pleased to share our proposal for','a thoughtful redesign of your digital home. Together, we will create an intuitive,','modern website that reflects your brand and helps your business move forward.'].forEach((v,i)=>text(v,55,382-i*16,9.5));
    text('Scope of work',55,310,12,bold,accent); text('A considered approach, from the first conversation to the final detail.',55,288,9.5);
    ['Discovery & strategy','User experience & interface design','Responsive website development','Content migration & optimization','Testing, refinement & launch'].forEach((v,i)=>{text('•',58,263-i*20,10,regular,muted);text(v,73,263-i*20,9.5);});
    line(141); text('Designed around your goals.',55,117,12,serif,muted); text('Built for what comes next.',55,98,12,serif,muted);
  } else {
    const sections = index===1 ? [['01  Discover','We begin by listening. Stakeholder interviews, content review, and a clear','understanding of your audience give every design decision a purpose.'],['02  Design','A focused visual direction brings the strategy to life. We explore layouts,','typography, and interactions, refining the details together.'],['03  Build','Responsive development turns the approved designs into a fast, accessible','website that feels natural on every screen.']] : index===2 ? [['Weeks 1-2  /  Discovery','Research, stakeholder conversations, content audit, and a shared project plan.','Milestone: an agreed sitemap and creative brief.'],['Weeks 3-5  /  Design','Visual direction, page layouts, and an interactive prototype.','Milestone: approved designs for desktop and mobile.'],['Weeks 6-8  /  Development','Build, content migration, accessibility checks, and final refinements.','Milestone: a tested website, ready to launch.']] : [['Project investment','Strategy and design                         $7,200','Development, content, and launch          $10,200'],['Working together','A 40% deposit starts the project. The remaining balance is split between','design approval and launch. All amounts are in USD.'],['Let us make something useful.','Review the proposal, share your questions, and let us know when you are','ready. We look forward to building your next chapter together.']];
    sections.forEach((s,i)=>{const y=530-i*130;text(s[0],55,y,13,bold,accent);text(s[1],55,y-29,10);text(s[2],55,y-47,10);line(y-80);});
  }
  line(60); text('ACME STUDIO  /  TECHNOVA',55,42,7,regular,muted); text('PROJECT PROPOSAL',263,42,7,regular,muted); text(`0${index+1} / 04`,526,42,7,regular,muted);
}
await mkdir('public/samples',{recursive:true});
await writeFile('public/samples/Project_Proposal.pdf',await pdf.save());
const zip = new JSZip();
zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
const paragraphs = ['Creative Brief','TechNova · Website redesign','The idea','A clear, welcoming digital home that makes complex work feel approachable.','Our audience','Curious teams looking for a thoughtful technology partner. They value clarity, experience, and a straightforward path to getting started.','Design principles','Keep it calm. Give every element room to breathe. Let strong typography and useful content do the work.','Tone of voice','Human, confident, and concise. Say what matters, then leave space for the reader.','Deliverables','A responsive website, a simple content system, and a small library of reusable design components.'];
zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs.map(p=>'<w:p><w:r><w:t>'+p+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>');
await writeFile('public/samples/Creative_Brief.docx',await zip.generateAsync({type:'nodebuffer'}));
console.log('Created PDF and DOCX sample documents.');
