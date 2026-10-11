// Semua subset kartu dengan ukuran minSize sampai maxSize, urutan input dipertahankan.
export function subsets<T>(items: T[], minSize: number, maxSize: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, picked: T[]) => {
    if (picked.length >= minSize) out.push(picked);
    if (picked.length === maxSize) return;
    for (let i = start; i < items.length; i++) walk(i + 1, [...picked, items[i]]);
  };
  walk(0, []);
  return out;
}
