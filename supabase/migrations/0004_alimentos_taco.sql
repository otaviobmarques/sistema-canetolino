-- Base nutricional inicial (valores por 100 g, alimento preparado). Ampliar com a TACO/TBCA completa.
insert into foods (id, nome, fonte, versao_tabela, preparo, proteina_100g, energia_100g) values
('frango','Peito de frango grelhado','TACO','TACO 4ª ed.','grelhado',32,159),
('feijao','Feijão carioca','TACO','TACO 4ª ed.','cozido',4.8,76),
('arroz','Arroz branco','TACO','TACO 4ª ed.','cozido',2.5,128),
('salada','Salada de folhas e tomate','TACO','TACO 4ª ed.','cru',1.2,15),
('ovo','Ovo de galinha','TACO','TACO 4ª ed.','cozido',13.3,146),
('patinho','Carne bovina (patinho)','TACO','TACO 4ª ed.','grelhado',35.9,219),
('iogurte','Iogurte natural','TACO','TACO 4ª ed.','pronto',4.1,51),
('banana','Banana prata','TACO','TACO 4ª ed.','crua',1.3,98),
('pao','Pão francês','TACO','TACO 4ª ed.','pronto',8,300),
('queijo','Queijo minas frescal','TACO','TACO 4ª ed.','pronto',17.4,264),
('peixe','Tilápia grelhada','TBCA','TBCA 7.2','grelhado',26,128),
('batata','Batata inglesa','TACO','TACO 4ª ed.','cozida',1.2,52),
('macarrao','Macarrão','TACO','TACO 4ª ed.','cozido',3.4,102),
('whey','Whey protein','rótulo','rótulo','pó',80,400),
('leite','Leite integral','TACO','TACO 4ª ed.','pronto',3.2,61)
on conflict (id) do nothing;
