export const metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <main className="wrap" data-not-found="true">
      <section style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <p><a href="/">Return to homepage</a></p>
      </section>
    </main>
  );
}
