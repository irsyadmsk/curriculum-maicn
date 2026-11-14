export function accountTarget(next){
 if(typeof next!=='string'||next.startsWith('/akun.html'))return '/index.html';
 if(/^\/[a-z0-9-]+\.html(?:#[a-z0-9-]+)?$/.test(next))return next;
 return /^\/layanan\.html\?kind=(?:switch|project|collaboration|remedial|absence)$/.test(next)?next:'/index.html';
}
export function ssoLink(origin,next){const callback=new URL('/akun.html',origin);callback.searchParams.set('sso','return');callback.searchParams.set('next',accountTarget(next));const login=new URL('https://id.irsyads.com/');login.searchParams.set('redirect',callback.href);return login.href}
export async function connectSession(db,fetcher=fetch){const session=await db.getSession();if(!session?.access_token)return false;const response=await fetcher('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:session.access_token}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('SSO session verification failed');return true}
