function Topbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-[#e8e4da] bg-white px-6 lg:px-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-wider text-[#26332d]">
          LUBININ
        </h1>
        <p className="text-xs font-medium tracking-widest text-[#9b927f]">
          FOOD TRUCK · PUNTO DE VENTA
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold">Caja principal</p>
          <p className="text-xs text-green-700">● Caja abierta</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#26332d] text-lg text-white">
          👤
        </div>
      </div>
    </header>
  )
}

export default Topbar