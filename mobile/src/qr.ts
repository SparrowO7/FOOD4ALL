const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Treat scanned text only as a batch identifier; never navigate a scanned URL.
export function batchIdFromQr(input:string):string|null {
    const text=input.trim();
    if(UUID.test(text))return text;
    try {
        const u=new URL(text),parts=u.pathname.split('/').filter(Boolean);
        if(u.protocol==='food4all:'&&u.hostname==='batch'&&parts.length===1&&UUID.test(parts[0]))return parts[0];
        if(['https:','http:'].includes(u.protocol)&&parts.length===2&&['trace','donations'].includes(parts[0])&&UUID.test(parts[1]))return parts[1];
    } catch {}
    return null;
}
