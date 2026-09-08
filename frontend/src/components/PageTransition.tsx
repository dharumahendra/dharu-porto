import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-8%', opacity: 0, filter: 'blur(8px)' }}
          transition={{
            y: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.2 },
            filter: { duration: 0.2 },
          }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
