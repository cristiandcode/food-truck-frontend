
function CategoryTabs({ categories, activeCategory, onChange }) {
  return (
    <div className="mb-7 flex gap-2 overflow-x-auto pb-2">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onChange(category.id)}
          className={`flex shrink-0 select-none items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition active:scale-95 ${
            activeCategory === category.id
              ? 'bg-[#26332d] text-white shadow-md'
              : 'border border-[#e8e4da] bg-white text-[#66685f] hover:bg-[#eeece5]'
          }`}
        >
          <span>{category.icon}</span>
          {category.name}
        </button>
      ))}
    </div>
  )
}

export default CategoryTabs
