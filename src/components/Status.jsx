// Shared loading / error states. A failed load must render a plain, styled
// message — never a blank screen (especially when embedded in someone's page).

export function Loading({ label = 'Drawing the wheel…' }) {
  return <p className="status">{label}</p>;
}

export function ErrorState({ message }) {
  return (
    <div className="status">
      <p>Couldn’t load that wheel.</p>
      <p>{message}</p>
    </div>
  );
}
