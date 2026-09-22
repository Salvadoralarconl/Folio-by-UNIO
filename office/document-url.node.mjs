import test from 'node:test';
import assert from 'node:assert/strict';
import {internalDocumentUrl} from './document-url.mjs';

test('trusted ONLYOFFICE download URLs use the internal Docker service',()=>{
  const cases=[
    ['http://documentserver/cache/files/a?token=one','http://documentserver/cache/files/a?token=one'],
    ['http://localhost:8080/cache/files/a?token=two','http://documentserver/cache/files/a?token=two'],
    ['http://127.0.0.1:8080/cache/files/a?token=three','http://documentserver/cache/files/a?token=three'],
    ['https://office.getunio.dev/cache/files/a?token=four','http://documentserver/cache/files/a?token=four'],
  ];
  for(const [input,expected] of cases)assert.equal(internalDocumentUrl(input).href,expected);
});

test('untrusted or malformed document download URLs are rejected',()=>{
  const rejected=[
    'https://example.com/file',
    'https://office.getunio.dev.example.com/file',
    'http://office.getunio.dev/file',
    'https://office.getunio.dev:8443/file',
    'http://documentserver:8080/file',
    'http://localhost/file',
    'http://127.0.0.1:8081/file',
    'https://user:password@office.getunio.dev/file',
    'https://office.getunio.dev/file#fragment',
    'not a URL',
  ];
  for(const input of rejected)assert.throws(()=>internalDocumentUrl(input),/Unexpected document download URL/);
});
