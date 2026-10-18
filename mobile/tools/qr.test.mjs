import {test} from 'node:test';
import assert from 'node:assert/strict';
import {batchIdFromQr} from '../src/qr.ts';
const id='866f949f-2136-4e03-95dc-30fcafe82a45';
test('app scanner accepts raw IDs, Android links and existing website labels',()=>{
    for(const input of [id,' '+id+' ',`food4all://batch/${id}`,`https://food4all.example/trace/${id}`,`http://localhost:3021/donations/${id}`])assert.equal(batchIdFromQr(input),id);
});
test('foreign URL can only yield an ID, never an external navigation target',()=>{
    assert.equal(batchIdFromQr(`https://untrusted.example/trace/${id}`),id);
});
test('malformed, executable and unrelated QR payloads are rejected',()=>{
    for(const input of ['', '123', 'javascript:alert(1)', `file:///trace/${id}`,`food4all://other/${id}`,`https://example.com/${id}`,`https://example.com/trace/${id}/extra`,`food4all://batch/not-a-uuid`,'<script>alert(1)</script>'])assert.equal(batchIdFromQr(input),null);
});
