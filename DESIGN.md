# Design System: CleanRx — Modern Pharmacy & Inventory Management

## 1. Visual Theme & Atmosphere
A professional, modern, and elegant light-themed interface designed specifically for healthcare and pharmacy environments. The theme focuses on **cleanliness, efficiency, trust, and readability**. It uses pure white surfaces, soft slate-blue backgrounds, and crisp borders, contrasted with elegant teal, emerald, and indigo accents. Text contrast is highly optimized for retail pharmacy cashiers and administrators working long hours.

- **Background Mode:** Light mode (default & fixed for visual consistency across storefront and administrative offices)
- **Density:** 7/10 — balanced information layout, clean alignment, and comfortable whitespace
- **Aesthetic:** Modern minimal card layouts, subtle shadows, clean borders, and premium typography

---

## 2. Color Palette & Roles

### Base & Backgrounds
- **App Background (`--background`)**: `#f8fafc` (Slate 50 — clean, clinical, soft off-white)
- **Card Surfaces (`--surface`)**: `#ffffff` (Pure white for high-contrast separation)
- **Borders (`--border`)**: `#e2e8f0` (Slate 200 — thin, crisp, subtle division)
- **Dividers (`--divider`)**: `#f1f5f9` (Slate 100 — light grid dividers)

### Typography & Ink
- **Primary Text (`--text-primary`)**: `#0f172a` (Slate 900 — high-contrast black for critical labels, counts, and names)
- **Secondary Text (`--text-secondary`)**: `#475569` (Slate 600 — descriptions, sub-headers, secondary metrics)
- **Muted Text (`--text-muted`)**: `#94a3b8` (Slate 400 — disabled fields, timestamps, secondary barcodes)

### Brand & Accents
- **Teal Accent (`--primary`)**: `#0d9488` (Teal 600 — primary brand action color, symbolizing clean clinical care)
- **Teal Hover (`--primary-hover`)**: `#0f766e` (Teal 700)
- **Emerald Green (`--success`)**: `#059669` (Emerald 600 — approved states, healthy stock levels, correct data)
- **Indigo Blue (`--info`)**: `#2563eb` (Blue 600 — navigation, details, information flags)
- **Amber Orange (`--warning`)**: `#d97706` (Amber 600 — near expiry status, reorder warnings)
- **Rose Red (`--danger`)**: `#e11d48` (Rose 600 — critical warnings, expired lots, rejected adjustments)

---

## 3. Typography Rules
- **Headers (Page Titles)**: Medium/Bold Sans-serif, 24-28px, color `#0f172a`, tracking tight
- **Section Headers**: Semibold Sans-serif, 16-18px, color `#1e293b`
- **KPI Values (Large Numbers)**: Bold Sans-serif (Inter/Geist), 32-36px, color `#0f172a`, tracking tight
- **Table Headers**: Bold Sans-serif, 10-11px, uppercase, tracking wider, color `#64748b`
- **Body & Row Text**: Regular Sans-serif, 13-14px, color `#334155`
- **Monospace (Batches, IDs, Barcodes)**: Font-mono, 12px, color `#475569`

---

## 4. Component Design Patterns

### Modern Stat Cards (KPIs)
- Pure white background (`#ffffff`), border `1px solid #e2e8f0`, border-radius `16px`.
- Box shadow: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`.
- Left-side indicator: A colored accent bar or icon wrapper representing status (teal, amber, green, red).

### Data Tables
- Clean white rows, subtle horizontal dividers (`1px solid #f1f5f9`), no vertical borders.
- Hover state: Row background changes to `#f8fafc` with transition.
- Table headers: Light background (`#f8fafc`), sticky, and uppercase labels.

### Buttons & Actions
- **Primary Button**: Solid teal background (`#0d9488`), white text, rounded 12px, shadow, hover transition.
- **Secondary Button**: Clean white background, slate border, dark text, hover bg `#f8fafc`.
- **Destructive/Danger Button**: Red background (`#e11d48`) or red-bordered outline.

### Welcome / Command Header Banner
- Rounded 24px banner, light gradient background (teal-to-cyan theme), subtle health/pharmacy illustration.
- Clean typography and premium visual spacing.

---

## 5. Visual Assets (Generated via Nano Banana)
1. **`clean_rx_banner.jpg`**: A clean, abstract background featuring teal and green curves with subtle pharmacy-related icons or geometric shapes, used in page header banners and the login page.
2. **`clean_rx_logo.png`**: (CSS-based SVG/canvas icon) - An elegant medicine/cross logo.

---

## 6. Security & Multi-Branch Scoping Design Decisions

### Audit Logs (Branch-Agnostic)
Audit logs in `public.audit_logs` track system-wide events (such as user modifications, role adjustments, and branch-level parameters). 
- **Scoping**: Restricting logs by branch is deliberately avoided because audits must provide a single, complete, immutable trail of historical modifications across the entire corporation.
- **Gating**: Only global administrator roles (`super_admin` and `admin`) have read access to the audit logs ledger. Standard employees and managers are blocked from seeing any log lines to protect confidentiality.

### Notifications (Branch-Agnostic)
Notifications currently serve as critical system-wide announcements or near-expiry and stock-out alerts.
- **Scoping**: Active notifications are currently global and accessible to all active staff.
- **Future Partitioning**: If future branch-specific notifications are desired, a `branch_id` column can be safely introduced. However, standard system warnings and notices remain branch-agnostic to support operational awareness.

### Manager UI Strategy
Managers share the employee dashboard interface for billing, stock queries, and batch adjustments. However:
- All actions executed by a manager (such as billing or adjustments) are scoped to their assigned `branch_id` on the server side.
- Managers manage staff through the `/admin/employees` panel, but the system restricts their visibility and operations to users within their own branch.

