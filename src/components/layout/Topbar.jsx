
function Topbar({ activePage, onNavigate }) {
  const navigationItems = [
    { id: 'pos', label: 'TPV', icon: '🛒' },
    { id: 'sales', label: 'Ventas', icon: '📋' },
    { id: 'products', label: 'Productos', icon: '📦' },
  ]

  return (
    <header className="sticky top-0 z-40 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-[#e8e4da] bg-white px-5 py-3 lg:px-10">

      {/* Logo */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-wider text-[#26332d]">
          LUBININ
        </h1>

        <p className="text-xs font-medium tracking-widest text-[#9b927f]">
          FOOD TRUCK · PUNTO DE VENTA
        </p>
      </div>

      {/* Navegación */}
      <nav className="order-3 flex w-full gap-2 sm:order-none sm:w-auto">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition sm:flex-none ${
              activePage === item.id
                ? 'bg-[#26332d] text-white shadow-sm'
                : 'bg-[#f5f3ee] text-[#66685f] hover:bg-[#eeece5]'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Estado de caja */}
      <div className="hidden items-center gap-3 sm:flex">
        <div className="text-right">
          <p className="text-sm font-semibold">
            Caja principal
          </p>

          <p className="text-xs text-green-700">
            ● Caja abierta
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#26332d] text-lg text-white">
          👤
        </div>
      </div>

    </header>
  )
}

export default Topbar
