/**
 * Host-only UI kit (`dreamer-genui/ui`).
 *
 * shadcn-parity of capability (not pixel identity) for host chrome. Every
 * component is token-only, density/RTL aware and independently importable
 * through `dreamer-genui/ui/<component>` so one import never pulls the rest.
 * This entry is never imported by the board renderer; it lives outside the
 * core bundle.
 */
export { cx } from './lib';
export { Button } from './button';
export type { ButtonProps } from './button';
export { Input } from './input';
export { Textarea } from './textarea';
export { Label } from './label';
export { Checkbox } from './checkbox';
export { Switch } from './switch';
export { RadioGroup, RadioGroupItem } from './radio-group';
export { Slider } from './slider';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from './select';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog';
export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog';
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './sheet';
export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent } from './popover';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuRadioGroup,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from './dropdown-menu';
export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './tooltip';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';
export { Avatar, AvatarImage, AvatarFallback } from './avatar';
export { Progress } from './progress';
export { Separator } from './separator';
export { Badge } from './badge';
export type { BadgeProps } from './badge';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardMedia } from './card';
export { Alert } from './alert';
export type { AlertProps } from './alert';
export { Kbd } from './kbd';
export { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar, ScrollAreaThumb } from './scroll-area';
export { AspectRatio } from './aspect-ratio';
export { Toggle } from './toggle';
export type { ToggleProps } from './toggle';
export { ToggleGroup, ToggleGroupItem } from './toggle-group';
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  Toaster,
} from './toast';
export { Spinner } from './spinner';
export { Skeleton } from './skeleton';
export { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from './empty';
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './breadcrumb';
export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  PaginationSpacer,
} from './pagination';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './table';
export { Heading, Text, Lead, Muted, Blockquote, Code, InlineCode } from './typography';
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator, InputOTPWithSeparator } from './input-otp';
export { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './resizable';
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuRadioGroup,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from './context-menu';
export { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card';
export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarGroup,
  MenubarPortal,
  MenubarSub,
  MenubarRadioGroup,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarContent,
  MenubarItem,
  MenubarCheckboxItem,
  MenubarRadioItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarShortcut,
} from './menubar';
export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuViewport,
  NavigationMenuIndicator,
} from './navigation-menu';
export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
  CommandLoading,
  CommandDialog,
} from './command';
export { Combobox } from './combobox';
export { Calendar } from './calendar';
export { DatePicker } from './date-picker';
export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from './drawer';
export { ButtonGroup, ButtonGroupText, ButtonGroupSeparator } from './button-group';
export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea, InputGroupText } from './input-group';
export { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from './native-select';
export {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemHeader,
  ItemFooter,
  ItemSeparator,
} from './item';
export {
  Field,
  FieldSet,
  FieldLegend,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldContent,
  FieldTitle,
} from './field';
export {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from './sidebar';
