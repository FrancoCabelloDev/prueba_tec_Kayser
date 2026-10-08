export default function App() {
  return (
    <main className="workspace">
      <header className="workspace-header">
        <p className="eyebrow">Equipo de TI</p>
        <h1>Tareas del equipo</h1>
        <p className="introduction">Organiza el trabajo de tu equipo en un solo lugar.</p>
      </header>

      <section className="workspace-content" aria-labelledby="workspace-title">
        <h2 id="workspace-title">Tu espacio de trabajo</h2>
        <p>Aquí podrás consultar y administrar las tareas del equipo.</p>
      </section>
    </main>
  );
}
