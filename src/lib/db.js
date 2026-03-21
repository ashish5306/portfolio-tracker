import { supabase } from './supabase';

export const db = {
  // Fetch transactions for the specific logged-in user
  getTransactions: async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error("DB Fetch Error:", error.message);
      return [];
    }
    return data;
  },

  // Save new transaction with the user's ID
  addTransaction: async (transaction) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ ...transaction, user_id: user.id }])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete transaction
  deleteTransaction: async (id) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};