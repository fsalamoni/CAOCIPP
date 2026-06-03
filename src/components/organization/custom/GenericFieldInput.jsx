import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { CITY_OPTIONS } from '@/lib/fieldTypes';

/**
 * Renderiza o input apropriado para um campo dinâmico.
 * props: field, value, onChange(value), members (lista p/ user_ref), error
 */
export default function GenericFieldInput({ field, value, onChange, members = [], error }) {
    const id = `f_${field.key}`;

    const renderControl = () => {
        switch (field.type) {
            case 'textarea':
                return (
                    <Textarea
                        id={id}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.help || ''}
                        rows={4}
                    />
                );
            case 'number':
            case 'currency':
                return (
                    <Input
                        id={id}
                        type="number"
                        step={field.type === 'currency' ? '0.01' : 'any'}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={field.help || ''}
                    />
                );
            case 'date':
                return (
                    <Input
                        id={id}
                        type="date"
                        value={value ? String(value).slice(0, 10) : ''}
                        onChange={(e) => onChange(e.target.value)}
                    />
                );
            case 'boolean':
                return (
                    <div className="flex items-center gap-2 pt-1">
                        <Switch
                            id={id}
                            checked={value === true || value === 'true'}
                            onCheckedChange={(c) => onChange(c)}
                        />
                        <span className="text-sm text-muted-foreground">
                            {value === true || value === 'true' ? 'Sim' : 'Não'}
                        </span>
                    </div>
                );
            case 'select':
                return (
                    <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(v)}>
                        <SelectTrigger id={id}>
                            <SelectValue placeholder={field.help || 'Selecione...'} />
                        </SelectTrigger>
                        <SelectContent>
                            {(field.options || []).map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'multiselect':
                return (
                    <MultiSelectControl
                        options={field.options || []}
                        value={Array.isArray(value) ? value : []}
                        onChange={onChange}
                        placeholder={field.help}
                    />
                );
            case 'user_ref':
                return (
                    <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(v)}>
                        <SelectTrigger id={id}>
                            <SelectValue placeholder={field.help || 'Selecione um membro...'} />
                        </SelectTrigger>
                        <SelectContent>
                            {members.map((m) => (
                                <SelectItem key={m.user_id || m.id} value={m.user_id || m.id}>
                                    {m.user_name || m.user_id}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'city':
                return (
                    <ComboboxControl
                        options={CITY_OPTIONS.map((c) => ({ value: c, label: c }))}
                        value={value ? String(value) : ''}
                        onChange={onChange}
                        placeholder={field.help || 'Selecione o município...'}
                    />
                );
            case 'link':
                return (
                    <Input
                        id={id}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.help || 'https://... ou caminho de rede'}
                    />
                );
            case 'text':
            default:
                return (
                    <Input
                        id={id}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.help || ''}
                    />
                );
        }
    };

    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {renderControl()}
            {field.help && field.type !== 'boolean' && (
                <p className="text-xs text-muted-foreground">{field.help}</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

function MultiSelectControl({ options, value, onChange, placeholder }) {
    const [open, setOpen] = React.useState(false);
    const toggle = (v) => {
        if (value.includes(v)) onChange(value.filter((x) => x !== v));
        else onChange([...value, v]);
    };
    return (
        <div className="space-y-1.5">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <span className="truncate">
                            {value.length ? `${value.length} selecionada(s)` : (placeholder || 'Selecione...')}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Buscar..." />
                        <CommandList>
                            <CommandEmpty>Nada encontrado.</CommandEmpty>
                            <CommandGroup>
                                {options.map((o) => (
                                    <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                                        <Check className={`mr-2 h-4 w-4 ${value.includes(o.value) ? 'opacity-100' : 'opacity-0'}`} />
                                        {o.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {value.map((v) => {
                        const opt = options.find((o) => o.value === v);
                        return (
                            <Badge key={v} variant="secondary" className="gap-1">
                                {opt?.label || v}
                                <button type="button" onClick={() => toggle(v)} className="hover:text-red-500">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ComboboxControl({ options, value, onChange, placeholder }) {
    const [open, setOpen] = React.useState(false);
    const selected = options.find((o) => o.value === value);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">{selected?.label || (placeholder || 'Selecione...')}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Buscar..." />
                    <CommandList>
                        <CommandEmpty>Nada encontrado.</CommandEmpty>
                        <CommandGroup>
                            {options.map((o) => (
                                <CommandItem
                                    key={o.value}
                                    value={o.label}
                                    onSelect={() => { onChange(o.value); setOpen(false); }}
                                >
                                    <Check className={`mr-2 h-4 w-4 ${value === o.value ? 'opacity-100' : 'opacity-0'}`} />
                                    {o.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
