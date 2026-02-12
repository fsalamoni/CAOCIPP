import * as React from "react"

declare module "@/components/ui/button" {
    export const Button: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/input" {
    export const Input: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/textarea" {
    export const Textarea: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/label" {
    export const Label: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/card" {
    export const Card: React.FC<any>
    export const CardHeader: React.FC<any>
    export const CardTitle: React.FC<any>
    export const CardContent: React.FC<any>
    export const CardFooter: React.FC<any>
}

declare module "@/components/ui/dialog" {
    export const Dialog: React.FC<any>
    export const DialogPortal: React.FC<any>
    export const DialogOverlay: React.ForwardRefExoticComponent<any>
    export const DialogTrigger: React.ForwardRefExoticComponent<any>
    export const DialogClose: React.ForwardRefExoticComponent<any>
    export const DialogContent: React.ForwardRefExoticComponent<any>
    export const DialogHeader: React.FC<any>
    export const DialogFooter: React.FC<any>
    export const DialogTitle: React.ForwardRefExoticComponent<any>
    export const DialogDescription: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/table" {
    export const Table: React.ForwardRefExoticComponent<any>
    export const TableHeader: React.ForwardRefExoticComponent<any>
    export const TableBody: React.ForwardRefExoticComponent<any>
    export const TableFooter: React.ForwardRefExoticComponent<any>
    export const TableHead: React.ForwardRefExoticComponent<any>
    export const TableRow: React.ForwardRefExoticComponent<any>
    export const TableCell: React.ForwardRefExoticComponent<any>
    export const TableCaption: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/select" {
    export const Select: React.FC<any>
    export const SelectGroup: React.FC<any>
    export const SelectValue: React.FC<any>
    export const SelectTrigger: React.ForwardRefExoticComponent<any>
    export const SelectContent: React.ForwardRefExoticComponent<any>
    export const SelectLabel: React.ForwardRefExoticComponent<any>
    export const SelectItem: React.ForwardRefExoticComponent<any>
    export const SelectSeparator: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/dropdown-menu" {
    export const DropdownMenu: React.FC<any>
    export const DropdownMenuTrigger: React.ForwardRefExoticComponent<any>
    export const DropdownMenuContent: React.ForwardRefExoticComponent<any>
    export const DropdownMenuItem: React.ForwardRefExoticComponent<any>
    export const DropdownMenuCheckboxItem: React.ForwardRefExoticComponent<any>
    export const DropdownMenuRadioItem: React.ForwardRefExoticComponent<any>
    export const DropdownMenuLabel: React.ForwardRefExoticComponent<any>
    export const DropdownMenuSeparator: React.ForwardRefExoticComponent<any>
    export const DropdownMenuShortcut: React.FC<any>
    export const DropdownMenuGroup: React.FC<any>
    export const DropdownMenuPortal: React.FC<any>
    export const DropdownMenuSub: React.FC<any>
    export const DropdownMenuSubContent: React.ForwardRefExoticComponent<any>
    export const DropdownMenuSubTrigger: React.ForwardRefExoticComponent<any>
    export const DropdownMenuRadioGroup: React.FC<any>
}

declare module "@/components/ui/badge" {
    export const Badge: React.FC<any>
}

declare module "@/components/ui/popover" {
    export const Popover: React.FC<any>
    export const PopoverTrigger: React.ForwardRefExoticComponent<any>
    export const PopoverContent: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/checkbox" {
    export const Checkbox: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/alert" {
    export const Alert: React.ForwardRefExoticComponent<any>
    export const AlertTitle: React.FC<any>
    export const AlertDescription: React.FC<any>
}

declare module "@/components/ui/alert-dialog" {
    export const AlertDialog: React.FC<any>
    export const AlertDialogPortal: React.FC<any>
    export const AlertDialogOverlay: React.ForwardRefExoticComponent<any>
    export const AlertDialogTrigger: React.ForwardRefExoticComponent<any>
    export const AlertDialogContent: React.ForwardRefExoticComponent<any>
    export const AlertDialogHeader: React.FC<any>
    export const AlertDialogFooter: React.FC<any>
    export const AlertDialogTitle: React.ForwardRefExoticComponent<any>
    export const AlertDialogDescription: React.ForwardRefExoticComponent<any>
    export const AlertDialogAction: React.ForwardRefExoticComponent<any>
    export const AlertDialogCancel: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/separator" {
    export const Separator: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/scroll-area" {
    export const ScrollArea: React.ForwardRefExoticComponent<any>
    export const ScrollBar: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/sheet" {
    export const Sheet: React.FC<any>
    export const SheetTrigger: React.ForwardRefExoticComponent<any>
    export const SheetClose: React.ForwardRefExoticComponent<any>
    export const SheetContent: React.ForwardRefExoticComponent<any>
    export const SheetHeader: React.FC<any>
    export const SheetFooter: React.FC<any>
    export const SheetTitle: React.ForwardRefExoticComponent<any>
    export const SheetDescription: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/skeleton" {
    export const Skeleton: React.FC<any>
}

declare module "@/components/ui/tabs" {
    export const Tabs: React.FC<any>
    export const TabsList: React.ForwardRefExoticComponent<any>
    export const TabsTrigger: React.ForwardRefExoticComponent<any>
    export const TabsContent: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/toast" {
    export const ToastProvider: React.FC<any>
    export const ToastViewport: React.ForwardRefExoticComponent<any>
    export const Toast: React.ForwardRefExoticComponent<any>
    export const ToastTitle: React.ForwardRefExoticComponent<any>
    export const ToastDescription: React.ForwardRefExoticComponent<any>
    export const ToastClose: React.ForwardRefExoticComponent<any>
    export const ToastAction: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/tooltip" {
    export const TooltipProvider: React.FC<any>
    export const Tooltip: React.FC<any>
    export const TooltipTrigger: React.ForwardRefExoticComponent<any>
    export const TooltipContent: React.ForwardRefExoticComponent<any>
}

declare module "@/components/ui/progress" {
    export const Progress: React.ForwardRefExoticComponent<any>
}
