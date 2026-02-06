import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Pencil, UserMinus, Crown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MembersTable({ 
  members, 
  currentUserId,
  isCreator,
  onUpdateFunction,
  onRemoveMember
}) {
  const [editingMember, setEditingMember] = useState(null);
  const [newFunction, setNewFunction] = useState("");

  const handleEditFunction = (member) => {
    setEditingMember(member);
    setNewFunction(member.function || "");
  };

  const handleSaveFunction = () => {
    if (editingMember) {
      onUpdateFunction(editingMember.id, newFunction);
      setEditingMember(null);
      setNewFunction("");
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">Membro</TableHead>
              <TableHead className="font-semibold">Função</TableHead>
              <TableHead className="font-semibold">Papel</TableHead>
              <TableHead className="font-semibold">Data de Ingresso</TableHead>
              {isCreator && <TableHead className="font-semibold text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-slate-200 text-slate-600 text-sm">
                        {getInitials(member.user_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-slate-900">{member.user_name}</p>
                      <p className="text-sm text-slate-500">{member.user_email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{member.function || '-'}</TableCell>
                <TableCell>
                  {member.role === 'creator' ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      <Crown className="w-3 h-3 mr-1" />
                      Criador
                    </Badge>
                  ) : (
                    <Badge variant="outline">Membro</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {format(new Date(member.created_date), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                {isCreator && (
                  <TableCell>
                    {member.role !== 'creator' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditFunction(member)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar Função
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onRemoveMember(member)}
                            className="text-rose-600"
                          >
                            <UserMinus className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Edição de Função */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Função</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Editando função de: <strong>{editingMember?.user_name}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="function">Função</Label>
              <Input
                id="function"
                placeholder="Ex: Assessor Jurídico"
                value={newFunction}
                onChange={(e) => setNewFunction(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFunction} className="bg-slate-900 hover:bg-slate-800">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}