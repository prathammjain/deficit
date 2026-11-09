/**
 * desk.tsx: the laptop admin exists on the web only (desk.web.tsx). On a
 * phone build there is nothing to show, and the stacked screens are used.
 */

export interface DeskProps {
  adminId: string;
  email: string | null;
  paywall: boolean;
}

export function AdminDesk(_props: DeskProps) {
  return null;
}
