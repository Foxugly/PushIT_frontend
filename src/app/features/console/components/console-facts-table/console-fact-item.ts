export interface ConsoleFactItem {
  label: string;
  value: string;
  severity?: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';
}
