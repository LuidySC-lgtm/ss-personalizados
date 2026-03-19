/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  Search, 
  Palette,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  LayoutGrid,
  List,
  Calendar,
  Edit2,
  Check,
  Hash,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  updateDoc,
  User
} from './firebase';
import { Timestamp } from 'firebase/firestore';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Erro no Firestore: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-transparent">
          <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 p-10 rounded-[32px] max-w-md w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
            <AlertCircle className="w-16 h-16 text-red-500/50 mx-auto mb-6" />
            <h2 className="text-white text-2xl font-light tracking-tight mb-2">Ops! Algo deu errado</h2>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full border border-white/10 text-white py-4 rounded-2xl font-medium hover:bg-white/5 transition-all active:scale-95"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Types ---
interface Project {
  id: string;
  name: string;
  canvaUrl: string;
  code: string;
  userId: string;
  createdAt: Timestamp;
}

// --- Components ---
const ProjectCard = ({ 
  project, 
  onDelete, 
  onUpdateName,
  viewMode,
  theme
}: { 
  project: Project, 
  onDelete: (id: string) => void | Promise<void>, 
  onUpdateName: (id: string, newName: string) => Promise<void>,
  viewMode: 'grid' | 'list',
  theme: 'dark' | 'light'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(project.name);

  const handleSave = async () => {
    if (editedName.trim() && editedName !== project.name) {
      await onUpdateName(project.id, editedName);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(project.name);
    setIsEditing(false);
  };

  if (viewMode === 'list') {
    return (
      <motion.div 
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className={`${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white/40 border-black/5'} border rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-[#C5A059]/30 transition-all group backdrop-blur-xl`}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`${theme === 'dark' ? 'bg-[#C5A059]/10' : 'bg-[#C5A059]/20'} p-2.5 rounded-lg shrink-0`}>
            <Palette className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex items-center gap-2 flex-1">
                  <input 
                    autoFocus
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className={`${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-black/5 text-black'} border border-[#C5A059]/30 rounded px-2 py-0.5 text-sm w-full focus:outline-none`}
                  />
                  <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-400"><Check className="w-4 h-4" /></button>
                  <button onClick={handleCancel} className={`${theme === 'dark' ? 'text-white/20 hover:text-white' : 'text-black/20 hover:text-black'}`}><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <h3 className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-medium text-base truncate`}>{project.name}</h3>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'text-white/20' : 'text-black/20'} hover:text-[#C5A059]`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 mt-0.5">
              <div className={`${theme === 'dark' ? 'text-white/40' : 'text-black/40'} flex items-center gap-1.5 text-[10px] uppercase tracking-widest`}>
                <Calendar className="w-3 h-3" />
                {project.createdAt.toDate().toLocaleDateString('pt-BR')}
              </div>
              <div className="flex items-center gap-1.5 text-[#C5A059]/60 text-[10px] uppercase tracking-widest font-mono">
                <Hash className="w-3 h-3" />
                {project.code || '---'}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-4">
          <a 
            href={project.canvaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#C5A059]/10 text-[#C5A059] p-2.5 rounded-lg hover:bg-[#C5A059] hover:text-black transition-all active:scale-95"
            title="Abrir no Canva"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button 
            onClick={() => onDelete(project.id)}
            className={`${theme === 'dark' ? 'text-white/20' : 'text-black/20'} hover:text-red-500 transition-colors p-2.5`}
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`${theme === 'dark' ? 'bg-black/40 border-white/5 shadow-xl' : 'bg-white/40 border-black/5 shadow-md'} border rounded-2xl p-6 flex flex-col justify-between hover:border-[#C5A059]/40 transition-all group relative overflow-hidden backdrop-blur-xl`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button 
          onClick={() => setIsEditing(true)}
          className={`${theme === 'dark' ? 'text-white/20 bg-black/50' : 'text-black/20 bg-white/50'} hover:text-[#C5A059] transition-colors p-1.5 backdrop-blur-md rounded-full`}
          title="Editar nome"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(project.id)}
          className={`${theme === 'dark' ? 'text-white/20 bg-black/50' : 'text-black/20 bg-white/50'} hover:text-red-500 transition-colors p-1.5 backdrop-blur-md rounded-full`}
          title="Excluir projeto"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div>
        <div className={`${theme === 'dark' ? 'bg-[#C5A059]/5 border-[#C5A059]/10' : 'bg-[#C5A059]/10 border-[#C5A059]/20'} w-12 h-12 rounded-xl flex items-center justify-center mb-6 border`}>
          <Palette className="w-6 h-6 text-[#C5A059]" />
        </div>
        
        {isEditing ? (
          <div className="flex items-center gap-2 mb-2">
            <input 
              autoFocus
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className={`${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-black/5 text-black'} border border-[#C5A059]/30 rounded px-2 py-1 text-lg w-full focus:outline-none`}
            />
            <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-400"><Check className="w-5 h-5" /></button>
          </div>
        ) : (
          <h3 className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-light text-xl mb-2 line-clamp-2 leading-tight tracking-tight`}>{project.name}</h3>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8">
          <div className={`${theme === 'dark' ? 'text-white/30' : 'text-black/30'} flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]`}>
            <Calendar className="w-3 h-3" />
            {project.createdAt.toDate().toLocaleDateString('pt-BR')}
          </div>
          <div className="flex items-center gap-2 text-[#C5A059]/50 text-[10px] uppercase tracking-[0.2em] font-mono">
            <Hash className="w-3 h-3" />
            {project.code || '---'}
          </div>
        </div>
      </div>
      
      <a 
        href={project.canvaUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="w-full border border-[#C5A059]/30 text-[#C5A059] py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#C5A059] hover:text-black transition-all active:scale-95 tracking-wide"
      >
        <ExternalLink className="w-4 h-4" />
        ABRIR NO CANVA
      </a>
    </motion.div>
  );
};

const AppContent = () => {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('ss-theme');
    return (saved as 'dark' | 'light') || 'dark';
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Fixed ID for public access since login was removed
  const PUBLIC_USER_ID = 'public-user-ss';

  useEffect(() => {
    localStorage.setItem('ss-theme', theme);
  }, [theme]);

  // Projects Listener
  useEffect(() => {
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', PUBLIC_USER_ID),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    const query = (searchQuery || '').toLowerCase();
    return projects.filter(p => 
      (p.name?.toLowerCase() || '').includes(query) || 
      (p.code?.toLowerCase() || '').includes(query)
    );
  }, [projects, searchQuery]);

  const generateCode = () => {
    return `SS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUrl) return;

    // Basic URL validation
    if (!newUrl.startsWith('https://')) {
      setFeedback({ type: 'error', message: 'O link deve começar com https://' });
      return;
    }

    try {
      await addDoc(collection(db, 'projects'), {
        name: newName,
        canvaUrl: newUrl,
        code: generateCode(),
        userId: PUBLIC_USER_ID,
        createdAt: Timestamp.now()
      });
      setNewName('');
      setNewUrl('');
      setIsAdding(false);
      setFeedback({ type: 'success', message: 'Projeto salvo com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleUpdateProjectName = async (id: string, newName: string) => {
    try {
      await updateDoc(doc(db, 'projects', id), { name: newName });
      setFeedback({ type: 'success', message: 'Nome atualizado.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${id}`);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este projeto?')) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
      setFeedback({ type: 'success', message: 'Projeto excluído.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
        <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans pb-20 selection:bg-[#C5A059]/30 relative overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {/* Background Watermark */}
      <div className={`fixed inset-0 pointer-events-none flex items-center justify-center z-0 transition-opacity duration-300 ${theme === 'dark' ? 'opacity-[0.08]' : 'opacity-[0.04]'}`}>
        <img 
          src="/logo_ss.png" 
          alt="" 
          className="w-[800px] max-w-[90vw] object-contain"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Header */}
      <header className={`backdrop-blur-xl border-b sticky top-0 z-30 relative transition-colors duration-300 ${theme === 'dark' ? 'bg-black/50 border-white/5' : 'bg-white/50 border-black/5'}`}>
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-display text-5xl text-[#C5A059] tracking-tighter drop-shadow-[0_0_15px_rgba(197,160,89,0.4)]">
              SS
            </div>
            <div className="flex flex-col">
              <h1 className="text-[#C5A059] font-light text-2xl tracking-tight leading-none">PERSONALIZADO</h1>
              <p className={`text-[10px] uppercase tracking-[0.3em] mt-1 ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>Atelier de Design</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2.5 rounded-full transition-all border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-[#C5A059] hover:bg-white/10' : 'bg-black/5 border-black/10 text-[#C5A059] hover:bg-black/10'}`}
              title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className={`hidden sm:flex items-center rounded-full p-1 border transition-colors duration-300 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-full transition-all ${viewMode === 'grid' ? 'bg-[#C5A059] text-black shadow-lg' : theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black'}`}
                title="Ver como Grade"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-full transition-all ${viewMode === 'list' ? 'bg-[#C5A059] text-black shadow-lg' : theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black'}`}
                title="Ver como Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 relative z-10">
        {/* Dashboard Actions */}
        <div className="flex flex-col md:flex-row gap-6 mb-16 items-center">
          <div className="relative flex-1 w-full">
            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-white/20' : 'text-black/20'}`} />
            <input 
              type="text" 
              placeholder="BUSCAR PROJETO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-2xl py-5 pl-14 pr-6 focus:outline-none focus:border-[#C5A059]/30 transition-all text-sm tracking-widest ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 text-white placeholder:text-white/10' : 'bg-black/[0.03] border-black/5 text-black placeholder:text-black/20'}`}
            />
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full md:w-auto bg-[#C5A059] text-black px-10 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#C5A059]/90 transition-all active:scale-95 shadow-[0_10px_30px_rgba(197,160,89,0.2)] whitespace-nowrap text-sm tracking-widest"
          >
            <Plus className="w-5 h-5" />
            NOVO PROJETO
          </button>
        </div>

        {/* Projects Display */}
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8" 
          : "flex flex-col gap-4 max-w-4xl mx-auto"
        }>
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onDelete={handleDeleteProject} 
                onUpdateName={handleUpdateProjectName}
                viewMode={viewMode}
                theme={theme}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-center py-32 rounded-[40px] border border-dashed ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.02] border-black/5'}`}
          >
            <div className={`${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.03]'} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}>
              <Search className={`w-8 h-8 ${theme === 'dark' ? 'text-white/10' : 'text-black/10'}`} />
            </div>
            <h3 className={`${theme === 'dark' ? 'text-white' : 'text-black'} text-xl font-light mb-2 tracking-tight`}>Nenhum projeto encontrado</h3>
            <p className={`${theme === 'dark' ? 'text-white/20' : 'text-black/20'} text-sm uppercase tracking-widest`}>
              {searchQuery ? 'Tente uma busca diferente.' : 'Comece adicionando seu primeiro projeto.'}
            </p>
          </motion.div>
        )}
      </main>

      {/* Add Project Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className={`absolute inset-0 backdrop-blur-md ${theme === 'dark' ? 'bg-black/90' : 'bg-white/90'}`}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative border w-full max-w-xl rounded-[32px] p-10 shadow-2xl overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent opacity-50" />
              
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className={`text-3xl font-light tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Novo <span className="text-[#C5A059] font-medium">Projeto</span></h2>
                  <p className={`text-[10px] uppercase tracking-[0.3em] mt-1 ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>Adicionar à coleção</p>
                </div>
                <button 
                  onClick={() => setIsAdding(false)}
                  className={`p-3 rounded-full transition-colors ${theme === 'dark' ? 'bg-white/5 text-white/40 hover:text-white' : 'bg-black/5 text-black/40 hover:text-black'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddProject} className="space-y-8">
                <div className="space-y-3">
                  <label className={`block text-[10px] font-bold uppercase tracking-[0.2em] ml-1 ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>Nome do Projeto</label>
                  <input 
                    required
                    type="text" 
                    placeholder="EX: IDENTIDADE VISUAL LUXO"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={`w-full border rounded-2xl py-5 px-6 focus:outline-none focus:border-[#C5A059]/30 transition-all text-sm tracking-wide ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 text-white placeholder:text-white/10' : 'bg-black/[0.03] border-black/5 text-black placeholder:text-black/20'}`}
                  />
                </div>
                <div className="space-y-3">
                  <label className={`block text-[10px] font-bold uppercase tracking-[0.2em] ml-1 ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>Link do Canva</label>
                  <input 
                    required
                    type="url" 
                    placeholder="HTTPS://WWW.CANVA.COM/..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className={`w-full border rounded-2xl py-5 px-6 focus:outline-none focus:border-[#C5A059]/30 transition-all text-sm tracking-wide ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 text-white placeholder:text-white/10' : 'bg-black/[0.03] border-black/5 text-black placeholder:text-black/20'}`}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[#C5A059] text-black py-5 rounded-2xl font-bold hover:bg-[#C5A059]/90 transition-all active:scale-95 shadow-lg text-sm tracking-[0.2em]"
                >
                  SALVAR PROJETO
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border ${
              feedback.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/50 text-red-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
