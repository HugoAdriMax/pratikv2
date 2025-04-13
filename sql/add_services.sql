
-- Ajouter le service "Plomberie" s'il n'existe pas
INSERT INTO services (id, name, category, description)
VALUES 
('plomberie-1', 'Plomberie', 'Artisanat', 'Services de plomberie pour réparations et installations')
ON CONFLICT (id) DO NOTHING;

-- Ajouter le service "Électricité" s'il n'existe pas
INSERT INTO services (id, name, category, description)
VALUES 
('electricite-1', 'Électricité', 'Artisanat', 'Services électriques pour installations et dépannages')
ON CONFLICT (id) DO NOTHING;

-- Ajouter le service "Menuiserie" s'il n'existe pas
INSERT INTO services (id, name, category, description)
VALUES 
('menuiserie-1', 'Menuiserie', 'Artisanat', 'Travaux de menuiserie et charpente')
ON CONFLICT (id) DO NOTHING;

-- Ajouter le service "Peinture" s'il n'existe pas
INSERT INTO services (id, name, category, description)
VALUES 
('peinture-1', 'Peinture', 'Artisanat', 'Services de peinture intérieure et extérieure')
ON CONFLICT (id) DO NOTHING;

-- Ajouter le service "Jardinage" s'il n'existe pas
INSERT INTO services (id, name, category, description)
VALUES 
('jardinage-1', 'Jardinage', 'Extérieur', 'Services d''entretien de jardin et d''aménagement paysager')
ON CONFLICT (id) DO NOTHING;

-- Ajouter le service "Nettoyage" s'il n'existe pas
INSERT INTO services (id, name, category, description)
VALUES 
('nettoyage-1', 'Nettoyage', 'Entretien', 'Services de nettoyage professionnel')
ON CONFLICT (id) DO NOTHING;

