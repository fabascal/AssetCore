export type MenuNode = {
  id: number;
  label: string;
  icon: string | null;
  path: string;
  displayOrder: number;
  children: MenuNode[];
};
