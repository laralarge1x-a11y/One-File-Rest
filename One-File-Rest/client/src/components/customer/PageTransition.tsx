import React from 'react';
import { motion } from 'framer-motion';

interface Props { children: React.ReactNode; }

export default function PageTransition({ children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}
