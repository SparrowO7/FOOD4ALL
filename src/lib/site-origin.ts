import {headers} from 'next/headers';
export async function siteOrigin(){
 const configured=process.env.NEXT_PUBLIC_SITE_URL?.trim();
 if(configured){const url=new URL(configured);if(!['http:','https:'].includes(url.protocol))throw new Error('Invalid site URL');return url.origin;}
 const h=await headers();const host=h.get('host');if(!host||! /^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host))throw new Error('Set NEXT_PUBLIC_SITE_URL for the printed food label.');
 const protocol=h.get('x-forwarded-proto')==='https'?'https':'http';return `${protocol}://${host}`;
}
