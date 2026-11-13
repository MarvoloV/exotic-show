import Link from "next/link";

const steps = [
  ["01", "Organiza", "Registro y consulta de participantes."],
  ["02", "Comparte", "Un enlace y un código QR por participante."],
  ["03", "Recibe", "Confirmación clara del ingreso desde el celular."],
];

export default function HomePage() {
  return (
    <div className="landing-screen" id="inicio">
      <header className="landing-header">
        <a className="landing-brand" href="#inicio" aria-label="The Exotic Show, inicio">
          <span className="landing-monogram" aria-hidden="true">QR</span>
          <span><strong>The Exotic Show</strong><small>Cabaret &amp; Pole Art · Pucará Rooftop</small></span>
        </a>
        <Link className="landing-admin" href="/login">Acceso <span>administrativo</span><span aria-hidden="true"> →</span></Link>
      </header>

      <div className="landing-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <p className="landing-eyebrow"><span aria-hidden="true">●</span> Un ingreso más simple · The Exotic Show</p>
          <h1 id="landing-title">Menos filas.<br /><span>Más espectáculo.</span></h1>
          <p className="landing-intro">Una base para organizar participantes y controlar su asistencia mediante código QR, desde cualquier dispositivo.</p>
          <Link href="/login" className="landing-cta">Acceder con mi correo <span aria-hidden="true">→</span></Link>
          <p className="landing-note">◇ &nbsp;Solo para administradores habilitados.</p>
          <div className="landing-credits">
            <div><p>Presentación especial</p><strong>Vía Botello</strong></div>
            <div><p>Producción escénica</p><strong>Pole Studio</strong></div>
          </div>
        </section>

        <section className="landing-experience" id="experiencia" aria-labelledby="experience-title">
          <p className="landing-eyebrow">El recorrido · The Exotic Show</p>
          <h2 id="experience-title">Una experiencia, <em>de principio a fin</em></h2>
          <ol className="landing-steps">
            {steps.map(([number, title, description]) => (
              <li key={number}>
                <span className="landing-step-number" aria-hidden="true">{number}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ol>
          <div className="landing-poster" id="cartelera">
            <div className="landing-poster-image" role="img" aria-label="Imagen escénica de The Exotic Show" />
            <div className="landing-poster-copy">
              <p>Cartelera oficial</p>
              <h3>The Exotic Show</h3>
              <span>Presentación: Vía Botello</span>
              <span>Pole Studio · Pucará Rooftop</span>
            </div>
          </div>
        </section>
      </div>
      <footer className="landing-footer"><strong>The Exotic Show</strong><span>Pole Studio · Pucará Rooftop</span><span>Asistencia QR</span></footer>
    </div>
  );
}
