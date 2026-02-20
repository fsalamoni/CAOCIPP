import React from 'react';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// === Matéria Geral (Padrão) ===
const MATTER_CATEGORIES = [
    'Proteção da moralidade e do patrimônio público',
    'Cível',
    'Processual',
    'Recuperação judicial e falência',
    'Matéria de outro CAO',
];

// === Matéria Específica (Padrão) ===
const MATTER_SUBCATEGORIES = {
    'Proteção da moralidade e do patrimônio público': [
        'ACP / TAC / FRBL',
        'Agentes Públicos',
        'ANPC',
        'Anticorrupção',
        'Bens Públicos',
        'Concurso Público',
        'Controle da Administração Pública',
        'Emendas Parlamentares',
        'Improbidade Administrativa',
        'Intervenção do Ministério Público',
        'Licitações',
        'Publicidade (Promoção Pessoal)',
        'Procuradoria Municipal',
        'Serviço Público',
        'Outros (moralidade e patrimônio público)',
    ],
    'Cível': [
        'Contratos',
        'Família',
        'Registros Públicos',
        'Sucessões',
        'Outros (cível)',
    ],
    'Processual': [
        'Processo Civil',
        'Processo Administrativo',
    ],
    'Recuperação judicial e falência': [],
    'Matéria de outro CAO': [],
};

/**
 * MatterCategorySelect — Cascading selects for Matéria da Consulta.
 * Supports dynamic categories from organization settings.
 *
 * Props:
 *  - category: current general category value
 *  - subcategory: current specific subcategory value
 *  - onCategoryChange(value): callback when general category changes
 *  - onSubcategoryChange(value): callback when specific subcategory changes
 *  - disabled: optional, disables both selects
 *  - organization: optional, organization object containing custom settings
 */
export default function MatterCategorySelect({
    category = '',
    subcategory = '',
    onCategoryChange,
    onSubcategoryChange,
    disabled = false,
    organization
}) {
    // Determine if we should use custom settings or defaults
    const isCustom = organization?.matterSettings?.custom;

    // Get the list of categories (General)
    const categoriesList = isCustom
        ? (organization.matterSettings.categories || [])
        : MATTER_CATEGORIES;

    // Get the map of subcategories
    const subcategoriesMap = isCustom
        ? (organization.matterSettings.subcategories || {})
        : MATTER_SUBCATEGORIES;

    // Get specific subcategories for the selected general category
    const subcategories = category ? (subcategoriesMap[category] || []) : [];
    const hasSubcategories = subcategories.length > 0;

    const handleCategoryChange = (value) => {
        onCategoryChange(value);
    };

    return (
        <div className="space-y-3">
            {/* Matéria Geral */}
            <div className="space-y-1.5">
                <Label htmlFor="matter_category">Matéria da Consulta (Geral)</Label>
                <Select
                    value={category}
                    onValueChange={handleCategoryChange}
                    disabled={disabled}
                >
                    <SelectTrigger id="matter_category" className="w-full">
                        <SelectValue placeholder="Selecione a matéria geral..." />
                    </SelectTrigger>
                    <SelectContent>
                        {categoriesList.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Matéria Específica (only shown when subcategories exist) */}
            {hasSubcategories && (
                <div className="space-y-1.5">
                    <Label htmlFor="matter_subcategory">Matéria da Consulta (Específica)</Label>
                    <Select
                        value={subcategory}
                        onValueChange={onSubcategoryChange}
                        disabled={disabled}
                    >
                        <SelectTrigger id="matter_subcategory" className="w-full">
                            <SelectValue placeholder="Selecione a matéria específica..." />
                        </SelectTrigger>
                        <SelectContent>
                            {subcategories.map(sub => (
                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}

export { MATTER_CATEGORIES, MATTER_SUBCATEGORIES };
