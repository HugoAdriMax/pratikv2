import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../config/supabase';
import { Text, Button, Card } from '../../components/ui';

interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  is_selected: boolean;
  experience_years: number | null;
  hourly_rate: number | null;
}

// État local pour les services en cours d'édition
interface ServiceFormState {
  [serviceId: string]: {
    experience: string;
    rate: string;
    showDetails: boolean;
  };
}

const ServiceSelectionScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  // État pour gérer les formulaires de tous les services
  const [serviceFormState, setServiceFormState] = useState<ServiceFormState>({});
  
  // Load services and prestataire selections
  useEffect(() => {
    if (!user?.id) return;
    
    const loadPrestataireServices = async () => {
      try {
        setLoading(true);
        
        // Use the RPC function that returns services with selection status
        const { data, error } = await supabase.rpc(
          'get_prestataire_services',
          { prestataire_id: user.id }
        );
        
        if (error) throw error;
        
        // Set services data
        setServices(data || []);
        
        // Extract unique categories and sort them
        const uniqueCategories = [...new Set(data.map(service => service.category))].sort();
        setCategories(uniqueCategories);
        
        // Initialize all categories as expanded
        const initialExpandedState = uniqueCategories.reduce((acc, category) => {
          acc[category] = true; // Start with all categories expanded
          return acc;
        }, {});
        setExpandedCategories(initialExpandedState);
        
        // Initialize service form state
        const initialFormState: ServiceFormState = {};
        (data || []).forEach(service => {
          initialFormState[service.id] = {
            experience: service.experience_years ? String(service.experience_years) : '',
            rate: service.hourly_rate ? String(service.hourly_rate) : '',
            showDetails: false
          };
        });
        setServiceFormState(initialFormState);
      } catch (error) {
        console.error('Error loading services:', error);
        Alert.alert('Erreur', 'Impossible de charger les services disponibles');
      } finally {
        setLoading(false);
      }
    };
    
    loadPrestataireServices();
  }, [user?.id]);
  
  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  // Toggle service selection
  const toggleService = async (serviceId: string, isSelected: boolean) => {
    try {
      // Find the service to update
      const serviceIndex = services.findIndex(s => s.id === serviceId);
      if (serviceIndex === -1) return;
      
      // Optimistically update the UI
      const updatedServices = [...services];
      updatedServices[serviceIndex] = {
        ...updatedServices[serviceIndex],
        is_selected: !isSelected
      };
      setServices(updatedServices);
      
      // Update in the database
      const { data, error } = await supabase.rpc(
        'update_prestataire_service',
        {
          p_prestataire_id: user.id,
          p_service_id: serviceId,
          p_selected: !isSelected
        }
      );
      
      if (error) throw error;
      
      console.log('Service update result:', data);
    } catch (error) {
      console.error('Error toggling service:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la sélection');
      
      // Revert the optimistic update on error
      const serviceIndex = services.findIndex(s => s.id === serviceId);
      if (serviceIndex !== -1) {
        const revertedServices = [...services];
        revertedServices[serviceIndex] = {
          ...revertedServices[serviceIndex],
          is_selected: isSelected
        };
        setServices(revertedServices);
      }
    }
  };
  
  // Update service details (experience and rate)
  const updateServiceDetails = async (serviceId: string) => {
    try {
      setSaving(true);
      
      const formData = serviceFormState[serviceId];
      if (!formData) return;
      
      // Parse values
      const experience = formData.experience ? Number(formData.experience) : null;
      const rate = formData.rate ? Number(formData.rate) : null;
      
      // Update in the database
      const { data, error } = await supabase.rpc(
        'update_prestataire_service',
        {
          p_prestataire_id: user.id,
          p_service_id: serviceId,
          p_selected: true,
          p_experience_years: experience,
          p_hourly_rate: rate
        }
      );
      
      if (error) throw error;
      
      console.log('Service details update result:', data);
      
      // Success message
      Alert.alert('Succès', 'Détails du service mis à jour avec succès');
    } catch (error) {
      console.error('Error updating service details:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour les détails du service');
    } finally {
      setSaving(false);
    }
  };
  
  // Fonctions de gestion du formulaire
  const toggleServiceDetails = (serviceId: string) => {
    setServiceFormState(prevState => {
      const updatedState = { ...prevState };
      if (updatedState[serviceId]) {
        updatedState[serviceId] = {
          ...updatedState[serviceId],
          showDetails: !updatedState[serviceId].showDetails
        };
      }
      return updatedState;
    });
  };
  
  const updateExperience = (serviceId: string, value: string) => {
    setServiceFormState(prevState => {
      const updatedState = { ...prevState };
      if (updatedState[serviceId]) {
        updatedState[serviceId] = {
          ...updatedState[serviceId],
          experience: value
        };
      }
      return updatedState;
    });
  };
  
  const updateRate = (serviceId: string, value: string) => {
    setServiceFormState(prevState => {
      const updatedState = { ...prevState };
      if (updatedState[serviceId]) {
        updatedState[serviceId] = {
          ...updatedState[serviceId],
          rate: value
        };
      }
      return updatedState;
    });
  };
  
  // Filter services based on search query
  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Group services by category
  const groupedServices = categories.map(category => ({
    category,
    data: filteredServices.filter(service => service.category === category)
  })).filter(group => group.data.length > 0);
  
  // Render a service item
  const renderServiceItem = ({ item }: { item: Service }) => {
    const formState = serviceFormState[item.id] || { 
      experience: '', 
      rate: '', 
      showDetails: false 
    };
    
    return (
      <Card style={styles.serviceItem}>
        <View style={styles.serviceHeader}>
          <View style={styles.serviceInfo}>
            <Text variant="body1" weight="semibold">{item.name}</Text>
            <Text variant="body2" color="text-secondary" numberOfLines={2} style={styles.serviceDescription}>
              {item.description}
            </Text>
          </View>
          
          <Switch
            value={item.is_selected}
            onValueChange={() => toggleService(item.id, item.is_selected)}
            trackColor={{ false: COLORS.light, true: COLORS.primary + '50' }}
            thumbColor={item.is_selected ? COLORS.primary : COLORS.textSecondary}
          />
        </View>
        
        {item.is_selected && (
          <View>
            <TouchableOpacity 
              style={styles.detailsToggle}
              onPress={() => toggleServiceDetails(item.id)}
            >
              <Text variant="body2" color="primary" style={styles.detailsToggleText}>
                {formState.showDetails ? 'Masquer les détails' : 'Ajouter des détails'}
              </Text>
              <Ionicons 
                name={formState.showDetails ? 'chevron-up' : 'chevron-down'} 
                size={16} 
                color={COLORS.primary}
              />
            </TouchableOpacity>
            
            {formState.showDetails && (
              <View style={styles.detailsContainer}>
                <View style={styles.inputContainer}>
                  <Text variant="body2" style={styles.inputLabel}>Années d'expérience</Text>
                  <TextInput
                    style={styles.input}
                    value={formState.experience}
                    onChangeText={(value) => updateExperience(item.id, value)}
                    keyboardType="numeric"
                    placeholder="Ex: 5"
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Text variant="body2" style={styles.inputLabel}>Tarif horaire (€)</Text>
                  <TextInput
                    style={styles.input}
                    value={formState.rate}
                    onChangeText={(value) => updateRate(item.id, value)}
                    keyboardType="numeric"
                    placeholder="Ex: 50"
                  />
                </View>
                
                <Button
                  label="Enregistrer"
                  variant="primary"
                  size="sm"
                  onPress={() => updateServiceDetails(item.id)}
                  loading={saving}
                  style={styles.saveButton}
                />
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };
  
  // Render a category section
  const renderCategorySection = ({ item }: { item: { category: string, data: Service[] } }) => {
    const isExpanded = expandedCategories[item.category] || false;
    
    return (
      <Card style={styles.categorySection}>
        <TouchableOpacity 
          style={styles.categoryHeader} 
          onPress={() => toggleCategory(item.category)}
        >
          <Text variant="h4" weight="semibold">{item.category}</Text>
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={COLORS.dark}
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.categoryContent}>
            {item.data.map(service => (
              <React.Fragment key={service.id}>
                {renderServiceItem({ item: service })}
              </React.Fragment>
            ))}
          </View>
        )}
      </Card>
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Sélection de services</Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un service..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <Text variant="body2" color="text-secondary" style={styles.subtitle}>
        Sélectionnez les services que vous proposez pour recevoir des demandes pertinentes
      </Text>
      
      <FlatList
        data={groupedServices}
        renderItem={renderCategorySection}
        keyExtractor={item => item.category}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  subtitle: {
    padding: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: SPACING.sm,
    color: COLORS.dark,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: SPACING.xl,
  },
  categorySection: {
    marginVertical: SPACING.xs,
    marginHorizontal: SPACING.sm,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.light,
  },
  categoryContent: {
    padding: SPACING.sm,
  },
  serviceItem: {
    marginVertical: SPACING.xs,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  serviceDescription: {
    marginTop: 4,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    padding: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailsToggleText: {
    marginRight: 4,
  },
  detailsContainer: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.light + '50',
    borderRadius: BORDER_RADIUS.md,
  },
  inputContainer: {
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  saveButton: {
    marginTop: SPACING.sm,
  },
});

export default ServiceSelectionScreen;