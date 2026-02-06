# 🎨 CAOCIPP - Design System Reference

**Version:** 1.0.0  
**Last Updated:** 2026-02-05  
**Purpose:** UI/UX design patterns and component guidelines

---

## Design Principles

1. **Consistency:** Reuse components and patterns
2. **Clarity:** Clear visual hierarchy and labeling
3. **Efficiency:** Minimize clicks to complete tasks  
4. **Responsiveness:** Works on all devices
5. **Accessibility:** Usable by everyone

---

## Color System

### Primary Colors

```css
--primary: 222.2 47.4% 11.2%;          /* Indigo-900 (dark) */
--primary-foreground: 210 40% 98%;     /* White text on primary */
```

**Usage:** Main actions, links, active states

### Accent Colors

```css
--indigo-600: hsl(239, 84%, 67%);  /* Buttons, CTAs */
--violet-600: hsl(271, 81%, 56%);  /* Gradients, highlights */
```

### Semantic Colors

```css
--destructive: 0 84.2% 60.2%;         /* Red - errors, delete */
--success: 142 76% 36%;                /* Green - success states */
--warning: 38 92% 50%;                 /* Yellow - warnings */
--muted: 210 40% 96.1%;                /* Gray - disabled/muted */
```

### Status Colors (Processes)

- **Em triagem:** `bg-slate-100` (Gray)
- **Em elaboração:** `bg-blue-100` (Blue)
- **Em revisão:** `bg-yellow-100` (Yellow)
- **Na pasta:** `bg-green-100` (Green)
- **Urgente:** `bg-red-100` (Red)

---

## Typography

### Font Family

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

**Features:** System fonts for native feel and performance

### Font Sizes

| Size | Tailwind Class | Use Case |
|------|----------------|----------|
| 12px | `text-xs` | Labels, captions, metadata |
| 14px | `text-sm` | Body text, form inputs |
| 16px | `text-base` | Default body text |
| 18px | `text-lg` | Subheadings, emphasized text |
| 24px | `text-2xl` | Card titles, section headers |
| 30px | `text-3xl` | Page titles |

### Font Weights

| Weight | Tailwind Class | Use Case |
|--------|----------------|----------|
| 400 | `font-normal` | Body text |
| 500 | `font-medium` | Labels, buttons |
| 600 | `font-semibold` | SubHeadings |
| 700 | `font-bold` | Headings, emphasis |

---

## Spacing Scale

Tailwind's default spacing (4px increments):

| Value | Pixels | Usage |
|-------|--------|-------|
| `p-1` | 4px | Minimal padding |
| `p-2` | 8px | Small padding |
| `p-4` | 16px | Standard padding |
| `p-6` | 24px | Card/section padding |
| `gap-4` | 16px | Grid/flex gaps |

---

## Component Patterns

### Buttons

**Primary Button:**
```jsx
<Button className="bg-primary text-primary-foreground">
  Action
</Button>
```

**Destructive Button:**
```jsx
<Button variant="destructive">
  Delete
</Button>
```

**Ghost Button:**
```jsx
<Button variant="ghost">
  Cancel
</Button>
```

### Cards

**Standard Card:**
```jsx
<Card className="shadow-sm border-slate-200">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Forms

**Input Field:**
```jsx
<div>
  <Label htmlFor="field">Label *</Label>
  <Input
    id="field"
    value={value}
    onChange={handleChange}
    placeholder="Placeholder"
    className="mt-1"
  />
</div>
```

**Select Dropdown:**
```jsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
  </SelectContent>
</Select>
```

### Tables

**Data Table:**
```jsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Dialogs

**Modal Dialog:**
```jsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* Form/Content */}
  </DialogContent>
</Dialog>
```

---

## Layout Patterns

### Page Layout

```jsx
<div className="min-h-screen bg-background">
  {/* Header */}
  <header className="border-b">
    {/* Logo, Nav, User Menu */}
  </header>
  
  {/* Main Content */}
  <main className="container mx-auto p-6">
    {/* Page content */}
  </main>
</div>
```

### Grid Layouts

**Responsive Grid:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Items */}
</div>
```

### Flex Layouts

**Space Between:**
```jsx
<div className="flex items-center justify-between">
  <span>Left</span>
  <span>Right</span>
</div>
```

---

## Icons

**Library:** Lucide React v0.468.0

**Common Icons:**
- Navigation: `ChevronRight`, `Menu`, `X`
- Actions: `Plus`, `Edit`, `Trash2`, `Copy`
- Status: `Check`, `AlertCircle`, `Clock`
- Data: `FileText`, `Users`, `Filter`, `Search`

**Usage:**
```jsx
import { Plus } from 'lucide-react';

<Plus className="w-4 h-4" />
```

---

## Responsive Breakpoints

| Device | Min Width | Tailwind Prefix |
|--------|-----------|-----------------|
| Mobile | < 768px | (default) |
| Tablet | 768px | `md:` |
| Desktop | 1024px | `lg:` |
| Large Desktop | 1280px | `xl:` |

**Example:**
```jsx
<div className="text-sm md:text-base lg:text-lg">
  Responsive text
</div>
```

---

## Accessibility Guidelines

1. **Color Contrast:** Minimum 4.5:1 for text
2. **Focus Indicators:** Visible focus rings on interactive elements
3. **ARIA Labels:** Provided by Radix UI components
4. **Keyboard Navigation:** All actions accessible via keyboard
5 **Screen Readers:** Semantic HTML + ARIA attributes

---

## Animation & Transitions

**Loading Spinner:**
```jsx
<Loader2 className="w-6 h-6 animate-spin" />
```

**Hover Transitions:**
```jsx
<Button className="transition-colors hover:bg-primary/90">
  Hover Me
</Button>
```

**Fade In:**
```jsx
<div className="animate-in fade-in duration-300">
  Content
</div>
```

---

## Design Tokens (Tailwind Config)

Located in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... more colors
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};
```

---

## Component Library

**Radix UI Components Used:**
- `@radix-ui/react-dialog` - Modals
- `@radix-ui/react-dropdown-menu` - Dropdowns
- `@radix-ui/react-select` - Select inputs
- `@radix-ui/react-switch` - Toggle switches
- `@radix-ui/react-tabs` - Tab navigation
- `@radix-ui/react-avatar` - User avatars
- `@radix-ui/react-label` - Form labels

**Custom Components:**
Located in `src/components/ui/`

---

## Best Practices

1. **Reuse components** from `src/components/ui/`
2. **Use Tailwind classes** instead of custom CSS
3. **Follow naming conventions** (PascalCase for components)
4. **Maintain consistency** with existing patterns
5. **Test responsiveness** on mobile, tablet, desktop
6. **Verify accessibility** with keyboard navigation

---

## Conclusion

The CAOCIPP design system provides:
- ✅ Consistent visual language
- ✅ Reusable component patterns
- ✅ Accessible UI primitives
- ✅ Responsive layouts
- ✅ Modern, professional aesthetic

For implementation examples, see components in:
- `src/components/organization/`
- `src/pages/`
- `src/components/ui/`
