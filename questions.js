/* =========================================================================
   NOVA QUIZ — question bank.
   Each entry: { c:categoryId, d:difficulty(1 easy|2 med|3 hard), q, a:[4 options], k:correctIndex }
   German. Facts kept to well-established knowledge (cutoff ~early 2026).
   ========================================================================= */
'use strict';

const CATEGORIES = [
  { id: 'allgemein',  name: 'Allgemeinwissen', icon: 'star',    color: '#ffd76a' },
  { id: 'geschichte', name: 'Geschichte',      icon: 'clock',   color: '#e0a060' },
  { id: 'geografie',  name: 'Geografie',       icon: 'home',    color: '#28d695' },
  { id: 'wissenschaft', name: 'Wissenschaft',  icon: 'bolt',    color: '#7bd1ff' },
  { id: 'technik',    name: 'Technik & IT',    icon: 'chip',    color: '#b07bff' },
  { id: 'sport',      name: 'Sport',           icon: 'trophy',  color: '#ff8a3d' },
  { id: 'musik',      name: 'Musik',           icon: 'bolt',    color: '#ff5d6c' },
  { id: 'film',       name: 'Film & TV',       icon: 'eye',     color: '#54c5f8' },
  { id: 'kunst',      name: 'Kunst & Literatur', icon: 'edit',  color: '#f1b0d0' },
  { id: 'natur',      name: 'Natur & Tiere',   icon: 'clover',  color: '#46e39e' },
  { id: 'essen',      name: 'Essen & Trinken', icon: 'gift',    color: '#ffb02e' },
  { id: 'aktuelles',  name: 'Aktuelles',       icon: 'flame',   color: '#ff6a6a' },
  { id: 'gaming',     name: 'Gaming',          icon: 'cards',   color: '#9cff7b' },
  { id: 'mathe',      name: 'Mathe & Logik',   icon: 'info',    color: '#7afcff' },
];

const Q = [
  /* ---------------- Allgemeinwissen ---------------- */
  { c:'allgemein', d:1, q:'Wie viele Kontinente gibt es?', a:['5','6','7','8'], k:2 },
  { c:'allgemein', d:1, q:'Welche Farbe entsteht, wenn man Blau und Gelb mischt?', a:['Grün','Lila','Orange','Braun'], k:0 },
  { c:'allgemein', d:1, q:'Wie viele Minuten hat eine Stunde?', a:['100','60','30','90'], k:1 },
  { c:'allgemein', d:2, q:'Welches ist das härteste natürliche Material?', a:['Gold','Eisen','Diamant','Granit'], k:2 },
  { c:'allgemein', d:2, q:'Wie viele Buchstaben hat das deutsche Alphabet (ohne Umlaute/ß)?', a:['24','25','26','28'], k:2 },
  { c:'allgemein', d:2, q:'Welches Organ pumpt das Blut durch den Körper?', a:['Lunge','Leber','Herz','Niere'], k:2 },
  { c:'allgemein', d:3, q:'Was misst man mit einem Barometer?', a:['Temperatur','Luftdruck','Höhe','Lautstärke'], k:1 },
  { c:'allgemein', d:2, q:'Wie nennt man die Angst vor engen Räumen?', a:['Arachnophobie','Klaustrophobie','Agoraphobie','Akrophobie'], k:1 },
  { c:'allgemein', d:1, q:'Welche Form hat ein Stoppschild?', a:['Kreis','Dreieck','Achteck','Quadrat'], k:2 },
  { c:'allgemein', d:3, q:'Welches Edelgas wird in Leuchtreklamen für rotes Licht genutzt?', a:['Helium','Neon','Argon','Xenon'], k:1 },
  { c:'allgemein', d:2, q:'Wie viele Sekunden hat ein Tag (24h)?', a:['3600','86400','43200','100000'], k:1 },
  { c:'allgemein', d:3, q:'Welche Sprache hat weltweit die meisten Muttersprachler?', a:['Englisch','Spanisch','Hindi','Mandarin-Chinesisch'], k:3 },

  /* ---------------- Geschichte ---------------- */
  { c:'geschichte', d:1, q:'In welchem Jahr fiel die Berliner Mauer?', a:['1987','1989','1991','1985'], k:1 },
  { c:'geschichte', d:2, q:'Wer war der erste Bundeskanzler der Bundesrepublik Deutschland?', a:['Willy Brandt','Helmut Kohl','Konrad Adenauer','Ludwig Erhard'], k:2 },
  { c:'geschichte', d:1, q:'Welches Reich baute den Kolosseum in Rom?', a:['Griechen','Römer','Ägypter','Perser'], k:1 },
  { c:'geschichte', d:2, q:'In welchem Jahr begann der Erste Weltkrieg?', a:['1912','1914','1918','1939'], k:1 },
  { c:'geschichte', d:2, q:'Wer malte die Mona Lisa?', a:['Michelangelo','Raffael','Leonardo da Vinci','Donatello'], k:2 },
  { c:'geschichte', d:3, q:'Welche Königin regierte England während der "Goldenen Ära" im 16. Jh.?', a:['Victoria','Elisabeth I.','Maria Stuart','Anne'], k:1 },
  { c:'geschichte', d:2, q:'Welches Schiff sank 1912 auf seiner Jungfernfahrt?', a:['Lusitania','Titanic','Britannic','Bismarck'], k:1 },
  { c:'geschichte', d:3, q:'Wann landete der erste Mensch auf dem Mond?', a:['1965','1969','1972','1961'], k:1 },
  { c:'geschichte', d:1, q:'Welche Mauer trennte einst Ost- und West-Berlin?', a:['Chinesische Mauer','Berliner Mauer','Hadrianswall','Limes'], k:1 },
  { c:'geschichte', d:3, q:'Wer war der erste römische Kaiser?', a:['Julius Cäsar','Augustus','Nero','Konstantin'], k:1 },
  { c:'geschichte', d:2, q:'In welchem Land begann die Französische Revolution?', a:['Spanien','Frankreich','Italien','England'], k:1 },
  { c:'geschichte', d:3, q:'Welches antike Weltwunder stand in Alexandria?', a:['Hängende Gärten','Leuchtturm','Koloss','Zeusstatue'], k:1 },

  /* ---------------- Geografie ---------------- */
  { c:'geografie', d:1, q:'Was ist die Hauptstadt von Frankreich?', a:['Lyon','Marseille','Paris','Nizza'], k:2 },
  { c:'geografie', d:1, q:'Welcher ist der längste Fluss der Welt?', a:['Amazonas','Nil','Jangtsekiang','Mississippi'], k:1 },
  { c:'geografie', d:2, q:'In welchem Land liegt die Stadt Marrakesch?', a:['Ägypten','Tunesien','Marokko','Algerien'], k:2 },
  { c:'geografie', d:1, q:'Welcher ist der höchste Berg der Welt?', a:['K2','Mont Blanc','Mount Everest','Kilimandscharo'], k:2 },
  { c:'geografie', d:2, q:'Welches ist das flächenmäßig größte Land der Erde?', a:['China','USA','Kanada','Russland'], k:3 },
  { c:'geografie', d:2, q:'An welchem Meer liegt die Stadt Barcelona?', a:['Atlantik','Mittelmeer','Nordsee','Schwarzes Meer'], k:1 },
  { c:'geografie', d:3, q:'Was ist die Hauptstadt von Australien?', a:['Sydney','Melbourne','Canberra','Perth'], k:2 },
  { c:'geografie', d:2, q:'Welcher Kontinent ist der kälteste?', a:['Asien','Antarktika','Europa','Südamerika'], k:1 },
  { c:'geografie', d:3, q:'Welches Land hat die meisten Einwohner (Stand 2024)?', a:['China','USA','Indien','Indonesien'], k:2 },
  { c:'geografie', d:1, q:'Wie heißt die Hauptstadt von Italien?', a:['Mailand','Rom','Neapel','Turin'], k:1 },
  { c:'geografie', d:3, q:'Durch welche Stadt fließt die Moldau?', a:['Wien','Budapest','Prag','Warschau'], k:2 },
  { c:'geografie', d:2, q:'Welche Wüste ist die größte heiße Wüste der Welt?', a:['Gobi','Kalahari','Sahara','Atacama'], k:2 },

  /* ---------------- Wissenschaft ---------------- */
  { c:'wissenschaft', d:1, q:'Welches chemische Symbol hat Wasser?', a:['CO2','H2O','O2','NaCl'], k:1 },
  { c:'wissenschaft', d:2, q:'Welches Planet ist der Sonne am nächsten?', a:['Venus','Mars','Merkur','Erde'], k:2 },
  { c:'wissenschaft', d:2, q:'Wie viele Knochen hat ein erwachsener Mensch (ca.)?', a:['106','206','306','156'], k:1 },
  { c:'wissenschaft', d:1, q:'Welches Gas atmen Menschen zum Leben ein?', a:['Stickstoff','Kohlendioxid','Sauerstoff','Helium'], k:2 },
  { c:'wissenschaft', d:3, q:'Wer entwickelte die Relativitätstheorie?', a:['Newton','Einstein','Bohr','Tesla'], k:1 },
  { c:'wissenschaft', d:2, q:'Was ist die chemische Bezeichnung für Kochsalz?', a:['KCl','NaCl','CaCO3','H2SO4'], k:1 },
  { c:'wissenschaft', d:3, q:'Welches Teilchen hat eine negative Ladung?', a:['Proton','Neutron','Elektron','Photon'], k:2 },
  { c:'wissenschaft', d:2, q:'Welches Vitamin produziert der Körper bei Sonnenlicht?', a:['Vitamin A','Vitamin C','Vitamin D','Vitamin B12'], k:2 },
  { c:'wissenschaft', d:1, q:'Welcher Planet wird auch "Roter Planet" genannt?', a:['Jupiter','Mars','Saturn','Venus'], k:1 },
  { c:'wissenschaft', d:3, q:'Was ist die Lichtgeschwindigkeit (ca.)?', a:['300 km/s','3.000 km/s','300.000 km/s','30.000 km/s'], k:2 },
  { c:'wissenschaft', d:2, q:'Wie nennt man Tiere, die nur Pflanzen fressen?', a:['Karnivoren','Herbivoren','Omnivoren','Insektivoren'], k:1 },
  { c:'wissenschaft', d:3, q:'Welches Element hat die Ordnungszahl 1?', a:['Helium','Sauerstoff','Wasserstoff','Kohlenstoff'], k:2 },

  /* ---------------- Technik & IT ---------------- */
  { c:'technik', d:1, q:'Wofür steht die Abkürzung "CPU"?', a:['Central Processing Unit','Computer Power Unit','Central Print Unit','Core Process Utility'], k:0 },
  { c:'technik', d:2, q:'Welche Firma entwickelte das iPhone?', a:['Samsung','Apple','Google','Nokia'], k:1 },
  { c:'technik', d:2, q:'Was bedeutet "HTML"?', a:['HyperText Markup Language','High Tech Modern Language','Hyperlink Text Mode','Home Tool Markup'], k:0 },
  { c:'technik', d:1, q:'Welches Unternehmen besitzt das Betriebssystem Windows?', a:['Apple','Microsoft','Google','IBM'], k:1 },
  { c:'technik', d:3, q:'In welchem Zahlensystem rechnen Computer intern?', a:['Dezimal','Binär','Hexadezimal','Oktal'], k:1 },
  { c:'technik', d:2, q:'Was misst man in "Pixeln"?', a:['Lautstärke','Bildauflösung','Geschwindigkeit','Speicher'], k:1 },
  { c:'technik', d:3, q:'Wer gilt als Mitbegründer von Microsoft?', a:['Steve Jobs','Bill Gates','Elon Musk','Mark Zuckerberg'], k:1 },
  { c:'technik', d:2, q:'Was bedeutet "Wi-Fi" grob?', a:['Wireless Internet','Drahtloses Netzwerk','Wired Fiber','Web Filter'], k:1 },
  { c:'technik', d:3, q:'Welche Programmiersprache wurde nach einer Schlange benannt?', a:['Java','Python','Ruby','Cobra'], k:1 },
  { c:'technik', d:1, q:'Welches Gerät nutzt man zum Mauszeiger-Bewegen?', a:['Tastatur','Maus','Monitor','Drucker'], k:1 },
  { c:'technik', d:2, q:'Wofür steht "URL"?', a:['Uniform Resource Locator','Universal Reading Link','User Reference Line','Unified Routing Layer'], k:0 },
  { c:'technik', d:3, q:'Welches Unternehmen entwickelt die Suchmaschine, die "googeln" prägte?', a:['Yahoo','Bing','Google','DuckDuckGo'], k:2 },

  /* ---------------- Sport ---------------- */
  { c:'sport', d:1, q:'Wie viele Spieler stehen beim Fußball pro Team auf dem Feld?', a:['9','10','11','12'], k:2 },
  { c:'sport', d:2, q:'In welcher Sportart gibt es einen "Slam Dunk"?', a:['Volleyball','Basketball','Handball','Tennis'], k:1 },
  { c:'sport', d:2, q:'Wie oft finden die Olympischen Sommerspiele statt?', a:['Jedes Jahr','Alle 2 Jahre','Alle 4 Jahre','Alle 5 Jahre'], k:2 },
  { c:'sport', d:3, q:'Welches Land gewann die Fußball-WM 2014?', a:['Brasilien','Deutschland','Argentinien','Spanien'], k:1 },
  { c:'sport', d:2, q:'Wie viele Ringe hat das olympische Symbol?', a:['4','5','6','7'], k:1 },
  { c:'sport', d:1, q:'Mit welchem Körperteil darf man im Fußball den Ball NICHT spielen (Feldspieler)?', a:['Kopf','Brust','Hand','Fuß'], k:2 },
  { c:'sport', d:3, q:'In welcher Stadt fanden die Olympischen Sommerspiele 2024 statt?', a:['Tokio','Paris','Los Angeles','London'], k:1 },
  { c:'sport', d:2, q:'Wie lang ist ein Marathonlauf (ca.)?', a:['21 km','30 km','42 km','50 km'], k:2 },
  { c:'sport', d:3, q:'Welcher Tennisspieler hält den Rekord für die meisten Grand-Slam-Titel der Herren (Stand 2024)?', a:['Roger Federer','Rafael Nadal','Novak Djokovic','Pete Sampras'], k:2 },
  { c:'sport', d:1, q:'Wie viele Punkte gibt ein Touchdown im American Football?', a:['3','6','7','2'], k:1 },
  { c:'sport', d:2, q:'In welchem Land wurde die Sportart Sumo entwickelt?', a:['China','Korea','Japan','Thailand'], k:2 },
  { c:'sport', d:3, q:'Welches Land gewann die Fußball-EM 2024?', a:['England','Frankreich','Spanien','Deutschland'], k:2 },

  /* ---------------- Musik ---------------- */
  { c:'musik', d:1, q:'Wie viele Saiten hat eine Standard-Gitarre?', a:['4','5','6','7'], k:2 },
  { c:'musik', d:2, q:'Welche Band sang "Bohemian Rhapsody"?', a:['The Beatles','Queen','Led Zeppelin','Pink Floyd'], k:1 },
  { c:'musik', d:2, q:'Wie heißt der "King of Pop"?', a:['Elvis Presley','Michael Jackson','Prince','Freddie Mercury'], k:1 },
  { c:'musik', d:3, q:'Welcher Komponist schrieb die "9. Sinfonie" mit "Ode an die Freude"?', a:['Mozart','Bach','Beethoven','Chopin'], k:2 },
  { c:'musik', d:1, q:'Welches Instrument hat schwarze und weiße Tasten?', a:['Geige','Klavier','Trompete','Flöte'], k:1 },
  { c:'musik', d:2, q:'Aus welchem Land kommt die Band ABBA?', a:['Norwegen','Schweden','Dänemark','Finnland'], k:1 },
  { c:'musik', d:3, q:'Wie viele Töne hat eine Oktave (ganze Töne, C bis C)?', a:['7','8','12','10'], k:1 },
  { c:'musik', d:2, q:'Welche Sängerin ist für die "Eras Tour" bekannt?', a:['Beyoncé','Taylor Swift','Adele','Billie Eilish'], k:1 },
  { c:'musik', d:3, q:'Welches Instrument spielte Jimi Hendrix berühmt?', a:['Schlagzeug','Bass','E-Gitarre','Klavier'], k:2 },
  { c:'musik', d:1, q:'Was nutzt ein DJ hauptsächlich zum Auflegen?', a:['Trompete','Plattenspieler/Mixer','Harfe','Cello'], k:1 },

  /* ---------------- Film & TV ---------------- */
  { c:'film', d:1, q:'Welcher Zauberlehrling besucht Hogwarts?', a:['Frodo','Harry Potter','Percy Jackson','Luke Skywalker'], k:1 },
  { c:'film', d:2, q:'In welchem Film sagt man "Möge die Macht mit dir sein"?', a:['Star Trek','Star Wars','Avatar','Matrix'], k:1 },
  { c:'film', d:2, q:'Welches Studio produziert "Toy Story"?', a:['DreamWorks','Pixar','Warner','Universal'], k:1 },
  { c:'film', d:3, q:'Wer führte Regie bei "Titanic" (1997)?', a:['Steven Spielberg','James Cameron','Christopher Nolan','Ridley Scott'], k:1 },
  { c:'film', d:1, q:'Welche Farbe hat der Hulk?', a:['Blau','Rot','Grün','Gelb'], k:2 },
  { c:'film', d:2, q:'In welcher Serie gibt es die Häuser Stark und Lannister?', a:['The Witcher','Game of Thrones','Vikings','The Crown'], k:1 },
  { c:'film', d:3, q:'Welcher Film gewann 2020 den Oscar als bester Film?', a:['1917','Joker','Parasite','Once Upon a Time'], k:2 },
  { c:'film', d:2, q:'Wie heißt der Clownfisch in dem Pixar-Film?', a:['Dory','Nemo','Marlin','Bruce'], k:1 },
  { c:'film', d:3, q:'Welcher Schauspieler spielte den Joker in "The Dark Knight"?', a:['Joaquin Phoenix','Heath Ledger','Jared Leto','Jack Nicholson'], k:1 },
  { c:'film', d:1, q:'In welchem Filmgenre erscheinen oft Zombies und Geister?', a:['Komödie','Horror','Western','Musical'], k:1 },

  /* ---------------- Kunst & Literatur ---------------- */
  { c:'kunst', d:2, q:'Wer schrieb "Romeo und Julia"?', a:['Goethe','Shakespeare','Schiller','Dante'], k:1 },
  { c:'kunst', d:2, q:'Wer malte die "Sternennacht"?', a:['Picasso','Monet','Van Gogh','Dalí'], k:2 },
  { c:'kunst', d:1, q:'Wer schrieb "Faust"?', a:['Schiller','Goethe','Kafka','Mann'], k:1 },
  { c:'kunst', d:3, q:'Welcher Kunststil ist mit Picasso eng verbunden?', a:['Impressionismus','Kubismus','Barock','Realismus'], k:1 },
  { c:'kunst', d:2, q:'Wer schrieb die Harry-Potter-Bücher?', a:['J.R.R. Tolkien','J.K. Rowling','Stephen King','George R.R. Martin'], k:1 },
  { c:'kunst', d:3, q:'In welchem Museum hängt die Mona Lisa?', a:['Prado','Louvre','Uffizien','MoMA'], k:1 },
  { c:'kunst', d:2, q:'Wer schrieb "Die Verwandlung"?', a:['Kafka','Brecht','Hesse','Böll'], k:0 },
  { c:'kunst', d:3, q:'Welcher Bildhauer schuf die Statue "David"?', a:['Donatello','Michelangelo','Bernini','Rodin'], k:1 },
  { c:'kunst', d:1, q:'Welche drei Grundfarben gibt es in der Malerei?', a:['Rot, Grün, Blau','Rot, Gelb, Blau','Gelb, Grün, Lila','Schwarz, Weiß, Grau'], k:1 },
  { c:'kunst', d:2, q:'Wer schrieb "Der kleine Prinz"?', a:['Hemingway','Saint-Exupéry','Camus','Sartre'], k:1 },

  /* ---------------- Natur & Tiere ---------------- */
  { c:'natur', d:1, q:'Welches ist das größte lebende Tier der Welt?', a:['Elefant','Blauwal','Giraffe','Pottwal'], k:1 },
  { c:'natur', d:1, q:'Wie viele Beine hat eine Spinne?', a:['6','8','10','12'], k:1 },
  { c:'natur', d:2, q:'Welches Tier ist das schnellste Landtier?', a:['Löwe','Gepard','Gazelle','Pferd'], k:1 },
  { c:'natur', d:2, q:'Welcher Vogel kann nicht fliegen?', a:['Adler','Pinguin','Spatz','Taube'], k:1 },
  { c:'natur', d:3, q:'Wie heißt der Prozess, mit dem Pflanzen Energie aus Licht gewinnen?', a:['Photosynthese','Atmung','Verdauung','Osmose'], k:0 },
  { c:'natur', d:1, q:'Welches Tier wird "König der Tiere" genannt?', a:['Tiger','Löwe','Bär','Elefant'], k:1 },
  { c:'natur', d:2, q:'Wie viele Herzen hat ein Oktopus?', a:['1','2','3','4'], k:2 },
  { c:'natur', d:3, q:'Welches ist das giftigste Tier (relativ) der Welt?', a:['Kobra','Pfeilgiftfrosch','Skorpion','Würfelqualle'], k:3 },
  { c:'natur', d:2, q:'Welcher Baum trägt Eicheln?', a:['Buche','Eiche','Birke','Ahorn'], k:1 },
  { c:'natur', d:1, q:'Welches Tier sagt "Muh"?', a:['Schaf','Kuh','Pferd','Ziege'], k:1 },

  /* ---------------- Essen & Trinken ---------------- */
  { c:'essen', d:1, q:'Aus welchem Land stammt die Pizza ursprünglich?', a:['Frankreich','Italien','Spanien','Griechenland'], k:1 },
  { c:'essen', d:2, q:'Welches Getränk wird aus Weintrauben hergestellt?', a:['Bier','Wein','Whisky','Wodka'], k:1 },
  { c:'essen', d:2, q:'Welche Hauptzutat braucht man für Guacamole?', a:['Tomate','Avocado','Gurke','Mango'], k:1 },
  { c:'essen', d:1, q:'Welches Tier liefert die Milch für Mozzarella traditionell?', a:['Kuh','Büffel','Ziege','Schaf'], k:1 },
  { c:'essen', d:3, q:'Aus welchem Land kommt das Gericht Sushi?', a:['China','Thailand','Japan','Korea'], k:2 },
  { c:'essen', d:2, q:'Welches Gewürz ist das teuerste der Welt (pro Gramm)?', a:['Vanille','Safran','Kardamom','Zimt'], k:1 },
  { c:'essen', d:1, q:'Welche Frucht ist gelb und gebogen?', a:['Apfel','Banane','Orange','Birne'], k:1 },
  { c:'essen', d:3, q:'Welche Bohne ist die Grundlage von Schokolade?', a:['Sojabohne','Kakaobohne','Kaffeebohne','Vanillebohne'], k:1 },
  { c:'essen', d:2, q:'Welches Land ist für Croissants besonders bekannt?', a:['Italien','Frankreich','Deutschland','Belgien'], k:1 },
  { c:'essen', d:1, q:'Was ist die Hauptzutat von Pommes frites?', a:['Mais','Kartoffeln','Reis','Weizen'], k:1 },

  /* ---------------- Aktuelles (2024/2025) ---------------- */
  { c:'aktuelles', d:2, q:'Wer gewann die US-Präsidentschaftswahl 2024?', a:['Joe Biden','Kamala Harris','Donald Trump','Ron DeSantis'], k:2 },
  { c:'aktuelles', d:2, q:'In welcher Stadt fanden die Olympischen Sommerspiele 2024 statt?', a:['Los Angeles','Paris','Tokio','Brisbane'], k:1 },
  { c:'aktuelles', d:2, q:'Welches Land gewann die Fußball-EM 2024 in Deutschland?', a:['England','Spanien','Frankreich','Niederlande'], k:1 },
  { c:'aktuelles', d:3, q:'Wer gewann den Eurovision Song Contest 2024?', a:['Schweden','Nemo (Schweiz)','Italien','Ukraine'], k:1 },
  { c:'aktuelles', d:2, q:'Welches Unternehmen entwickelte ChatGPT?', a:['Google','Meta','OpenAI','Microsoft'], k:2 },
  { c:'aktuelles', d:3, q:'Welches Land gewann die Copa América 2024?', a:['Brasilien','Kolumbien','Argentinien','Uruguay'], k:2 },
  { c:'aktuelles', d:2, q:'Wie heißt das soziale Netzwerk, das früher "Twitter" hieß?', a:['Threads','X','Bluesky','Mastodon'], k:1 },
  { c:'aktuelles', d:3, q:'Welche Sängerin dominierte mit der "Eras Tour" 2023/24 die Charts?', a:['Dua Lipa','Taylor Swift','Olivia Rodrigo','Ariana Grande'], k:1 },
  { c:'aktuelles', d:2, q:'Welcher Tech-Milliardär leitet Tesla und SpaceX?', a:['Jeff Bezos','Elon Musk','Bill Gates','Tim Cook'], k:1 },
  { c:'aktuelles', d:3, q:'Welches Land war Gastgeber der Fußball-EM 2024?', a:['Italien','Deutschland','England','Spanien'], k:1 },

  /* ---------------- Gaming ---------------- */
  { c:'gaming', d:1, q:'Welcher Klempner ist Nintendos Maskottchen?', a:['Sonic','Mario','Link','Kirby'], k:1 },
  { c:'gaming', d:2, q:'In welchem Spiel baut und zerstört man Blöcke in einer Klötzchenwelt?', a:['Fortnite','Minecraft','Roblox','Terraria'], k:1 },
  { c:'gaming', d:2, q:'Welche Firma entwickelt die PlayStation?', a:['Microsoft','Sony','Nintendo','Sega'], k:1 },
  { c:'gaming', d:3, q:'Wie heißt die Hauptfigur der "The Legend of Zelda"-Reihe?', a:['Zelda','Link','Ganon','Epona'], k:1 },
  { c:'gaming', d:1, q:'Welches Spiel ist ein berühmtes Battle-Royale mit Bauen?', a:['Among Us','Fortnite','FIFA','Tetris'], k:1 },
  { c:'gaming', d:2, q:'Welche Konsole brachte Microsoft auf den Markt?', a:['Switch','Xbox','PlayStation','Dreamcast'], k:1 },
  { c:'gaming', d:3, q:'In welchem Jahr erschien das originale "Tetris" (ca.)?', a:['1975','1984','1995','2001'], k:1 },
  { c:'gaming', d:2, q:'Wie heißt der gelbe Geisterfresser im Arcade-Klassiker?', a:['Pac-Man','Donkey Kong','Q*bert','Frogger'], k:0 },
  { c:'gaming', d:3, q:'Welches Studio entwickelte "The Witcher 3"?', a:['Bethesda','CD Projekt Red','Ubisoft','Rockstar'], k:1 },
  { c:'gaming', d:1, q:'In welchem Spiel findet man "Creeper", die explodieren?', a:['Roblox','Minecraft','Fortnite','Valorant'], k:1 },

  /* ---------------- Mathe & Logik ---------------- */
  { c:'mathe', d:1, q:'Was ist 7 × 8?', a:['54','56','64','48'], k:1 },
  { c:'mathe', d:1, q:'Wie viele Seiten hat ein Sechseck?', a:['5','6','7','8'], k:1 },
  { c:'mathe', d:2, q:'Was ist die Quadratwurzel von 144?', a:['11','12','13','14'], k:1 },
  { c:'mathe', d:2, q:'Was ist 15 % von 200?', a:['20','30','15','25'], k:1 },
  { c:'mathe', d:3, q:'Was ist die nächste Primzahl nach 13?', a:['15','16','17','19'], k:2 },
  { c:'mathe', d:1, q:'Wie viel ist 100 geteilt durch 4?', a:['20','25','40','50'], k:1 },
  { c:'mathe', d:3, q:'Was ergibt 2 hoch 10?', a:['512','1000','1024','2048'], k:2 },
  { c:'mathe', d:2, q:'Wie viele Grad hat ein rechter Winkel?', a:['45','90','180','360'], k:1 },
  { c:'mathe', d:2, q:'Setze fort: 2, 4, 8, 16, …?', a:['24','30','32','64'], k:2 },
  { c:'mathe', d:3, q:'Wie lautet die Kreiszahl Pi auf 2 Nachkommastellen?', a:['3,12','3,14','3,16','3,18'], k:1 },
];

module.exports = { CATEGORIES, QUESTIONS: Q };
