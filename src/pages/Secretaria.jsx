import { Navigate, useLocation } from 'react-router-dom';

// A Secretaria Processual virou Processo Eletrônico: links antigos (e-mails,
// favoritos) continuam funcionando, com os mesmos parâmetros.
export default function Secretaria() {
    const { search } = useLocation();
    return <Navigate to={`/ProcessoEletronico${search}`} replace />;
}
