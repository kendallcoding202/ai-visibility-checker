import ConfirmForm from './ConfirmForm.js';

export const metadata = { title: 'Confirm your email', robots: { index: false, follow: false } };

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export default async function Page({ searchParams }) {
  const token = String((await searchParams).token ?? '');
  return (<header className="hero"><div className="wrap">
    <h1>Confirm your email</h1>
    {TOKEN.test(token)
      ? <ConfirmForm token={token} />
      : <p>This confirmation link is not valid or it has expired.</p>}
  </div></header>);
}
