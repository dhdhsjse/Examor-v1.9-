// Look shared by the setup cards (margins, header and footer).
export const cardClass = (selected: boolean) =>
  `flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-white text-start transition hover:border-indigo-300 hover:shadow-md ${selected ? "border-indigo-500 ring-2 ring-indigo-500" : "border-line"}`;
