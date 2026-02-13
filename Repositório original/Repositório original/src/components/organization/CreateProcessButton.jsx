import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import CreateProcessDialog from './CreateProcessDialog';

export default function CreateProcessButton({ organization, members, onSuccess }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700"
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Processo
      </Button>
      
      <CreateProcessDialog
        open={open}
        setOpen={setOpen}
        organization={organization}
        members={members}
        onSuccess={onSuccess}
      />
    </>
  );
}