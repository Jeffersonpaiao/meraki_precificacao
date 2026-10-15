export default function Brand({ loading = false }: { loading?: boolean }) {
  return (
    <span className={`meraki-brand${loading ? ' meraki-brand-loading' : ''}`}>
      <img
        src="/meraki-logo.jpg"
        width={2233}
        height={740}
        alt="Meraki — Mentoria e Consultoria"
        decoding="async"
      />
      <span className="meraki-product-name">PRECIFICAÇÃO</span>
    </span>
  );
}
