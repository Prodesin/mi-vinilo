#!/usr/bin/env python3
"""Genera tools/sample-collection.json (formato de la copia JSON de la app). Solo para pruebas: NO se carga en la app publicada.
Los release_id son ficticios (9 000 001 en adelante)."""
import json, random, os, datetime, base64, hashlib
random.seed(7)
BN, PR, IM, TBM, EW, RV, CO, VE, AT, EC, SJ, DE, CB, TR, MS, FL, DN, TK, KA, PA = (
 "Blue Note","Prestige","Impulse!","Three Blind Mice","East Wind","Riverside","Columbia","Verve","Atlantic","ECM Records","Strata-East","Denon","CTI Records","Trio Records","MPS","Fantasy","Discos Nuevos","Toshiba EMI","King Records","Paddle Wheel")
# (artista, título, año, sello, catálogo, estilos, género extra)
D = [
("Art Blakey & The Jazz Messengers","Moanin'",1959,BN,"BLP 4003",["Hard Bop"],""),
("Art Blakey & The Jazz Messengers","A Night in Tunisia",1961,BN,"BLP 4049",["Hard Bop"],""),
("Art Blakey & The Jazz Messengers","Ugetsu",1963,RV,"RLP 464",["Hard Bop"],""),
("Miles Davis","Kind of Blue",1959,CO,"CS 8163",["Modal"],""),
("Miles Davis","'Round About Midnight",1957,CO,"CL 949",["Hard Bop"],""),
("Miles Davis","Cookin'",1957,PR,"PRLP 7094",["Hard Bop"],""),
("Miles Davis","Relaxin'",1958,PR,"PRLP 7129",["Hard Bop"],""),
("Miles Davis","Milestones",1958,CO,"CL 1193",["Modal","Hard Bop"],""),
("Miles Davis","Sketches of Spain",1960,CO,"CS 8271",["Cool Jazz","Third Stream"],""),
("Miles Davis","Bitches Brew",1970,CO,"GP 26",["Fusion"],"Rock"),
("John Coltrane","A Love Supreme",1965,IM,"A-77",["Free Jazz","Modal"],""),
("John Coltrane","Blue Train",1958,BN,"BLP 1577",["Hard Bop"],""),
("John Coltrane","Giant Steps",1960,AT,"SD 1311",["Hard Bop","Post Bop"],""),
("John Coltrane","My Favorite Things",1961,AT,"SD 1361",["Modal"],""),
("John Coltrane","Ballads",1963,IM,"A-32",["Cool Jazz"],""),
("John Coltrane","Live at Birdland",1964,IM,"A-50",["Post Bop"],""),
("John Coltrane & Johnny Hartman","John Coltrane and Johnny Hartman",1963,IM,"A-40",["Vocal","Cool Jazz"],""),
("Sonny Rollins","Saxophone Colossus",1957,PR,"PRLP 7079",["Hard Bop"],""),
("Sonny Rollins","Way Out West",1957,"Contemporary","C 3530",["Hard Bop"],""),
("Sonny Rollins","A Night at the Village Vanguard",1958,BN,"BLP 1581",["Hard Bop"],""),
("Sonny Rollins","The Bridge",1962,"RCA Victor","LSP-2527",["Post Bop"],""),
("Thelonious Monk","Brilliant Corners",1957,RV,"RLP 12-226",["Bop","Post Bop"],""),
("Thelonious Monk","Monk's Dream",1963,CO,"CS 8765",["Bop"],""),
("Thelonious Monk","Genius of Modern Music, Vol. 1",1952,BN,"BLP 5002",["Bop"],""),
("Bill Evans Trio","Sunday at the Village Vanguard",1961,RV,"RLP 376",["Post Bop"],""),
("Bill Evans Trio","Waltz for Debby",1962,RV,"RLP 399",["Post Bop"],""),
("Bill Evans","Everybody Digs Bill Evans",1959,RV,"RLP 12-291",["Post Bop"],""),
("Bill Evans & Jim Hall","Undercurrent",1962,"United Artists Jazz","UAJ 14003",["Post Bop"],""),
("Dave Brubeck Quartet","Time Out",1959,CO,"CS 8192",["Cool Jazz"],""),
("Dave Brubeck Quartet","Time Further Out",1961,CO,"CS 8490",["Cool Jazz"],""),
("Herbie Hancock","Maiden Voyage",1965,BN,"BLP 4195",["Post Bop"],""),
("Herbie Hancock","Empyrean Isles",1964,BN,"BLP 4175",["Post Bop"],""),
("Herbie Hancock","Head Hunters",1973,CO,"KC 32731",["Jazz-Funk","Fusion"],"Funk / Soul"),
("Herbie Hancock","Takin' Off",1962,BN,"BLP 4109",["Hard Bop"],""),
("Wayne Shorter","Speak No Evil",1966,BN,"BLP 4194",["Post Bop"],""),
("Wayne Shorter","Juju",1965,BN,"BLP 4182",["Post Bop","Modal"],""),
("Wayne Shorter","Night Dreamer",1964,BN,"BLP 4173",["Post Bop"],""),
("Lee Morgan","The Sidewinder",1964,BN,"BLP 4157",["Hard Bop","Soul-Jazz"],""),
("Lee Morgan","Search for the New Land",1966,BN,"BLP 4169",["Post Bop"],""),
("Lee Morgan","Candy",1958,BN,"BLP 1590",["Hard Bop"],""),
("Horace Silver Quintet","Song for My Father",1965,BN,"BLP 4185",["Hard Bop"],""),
("Horace Silver","Blowin' the Blues Away",1959,BN,"BLP 4017",["Hard Bop"],""),
("Cannonball Adderley","Somethin' Else",1958,BN,"BLP 1595",["Hard Bop"],""),
("Cannonball Adderley","Mercy, Mercy, Mercy! Live at The Club",1966,"Capitol","ST 2663",["Soul-Jazz"],"Funk / Soul"),
("Charles Mingus","Mingus Ah Um",1959,CO,"CS 8171",["Post Bop"],""),
("Charles Mingus","The Black Saint and the Sinner Lady",1963,IM,"A-35",["Post Bop","Avant-garde Jazz"],""),
("Charles Mingus","Blues & Roots",1960,AT,"SD 1305",["Hard Bop"],""),
("Charlie Parker","Bird and Diz",1952,"Clef Records","MGC 512",["Bop"],""),
("Dizzy Gillespie","Dizzy Gillespie at Newport",1957,VE,"MGV 8242",["Big Band","Bop"],""),
("Stan Getz & João Gilberto","Getz/Gilberto",1964,VE,"V6-8545",["Bossa Nova"],"Latin"),
("Stan Getz","Focus",1962,VE,"V6-8412",["Third Stream"],""),
("Stan Getz","Jazz Samba",1962,VE,"V-8432",["Bossa Nova"],"Latin"),
("Duke Ellington","Money Jungle",1963,"United Artists Jazz","UAJ 14017",["Post Bop"],""),
("Duke Ellington & John Coltrane","Duke Ellington & John Coltrane",1963,IM,"A-30",["Post Bop"],""),
("Duke Ellington","Ellington at Newport 1956",1956,CO,"CL 934",["Big Band"],""),
("Louis Armstrong & Ella Fitzgerald","Ella and Louis",1956,VE,"MGV 4003",["Vocal","Swing"],""),
("Ella Fitzgerald","Ella Fitzgerald Sings the Cole Porter Song Book",1956,VE,"MGV 4001",["Vocal"],""),
("Billie Holiday","Lady in Satin",1958,CO,"CL 1157",["Vocal"],""),
("Nina Simone","Pastel Blues",1965,"Philips","PHS 600-187",["Vocal","Soul-Jazz"],"Funk / Soul"),
("Sarah Vaughan","Sarah Vaughan with Clifford Brown",1955,"EmArcy","MG 36004",["Vocal","Bop"],""),
("Chet Baker","Chet Baker Sings",1956,"Pacific Jazz","PJ-1222",["Cool Jazz","Vocal"],""),
("Chet Baker","Chet",1959,RV,"RLP 12-299",["Cool Jazz"],""),
("Gerry Mulligan","Night Lights",1963,"Philips","PHS 600-097",["Cool Jazz"],""),
("Clifford Brown & Max Roach","Clifford Brown and Max Roach",1955,"EmArcy","MG 36008",["Hard Bop"],""),
("Max Roach","We Insist! Freedom Now Suite",1960,"Candid","CJS 9002",["Free Jazz","Hard Bop"],""),
("Ornette Coleman","The Shape of Jazz to Come",1959,AT,"SD 1317",["Free Jazz"],""),
("Ornette Coleman","Free Jazz",1961,AT,"SD 1364",["Free Jazz"],""),
("Eric Dolphy","Out to Lunch!",1964,BN,"BLP 4163",["Avant-garde Jazz","Post Bop"],""),
("Eric Dolphy","Last Date",1964,"Fontana","SRF 67084",["Avant-garde Jazz"],""),
("Andrew Hill","Point of Departure",1964,BN,"BLP 4167",["Post Bop","Avant-garde Jazz"],""),
("Jackie McLean","Let Freedom Ring",1963,BN,"BLP 4106",["Hard Bop","Free Jazz"],""),
("Jackie McLean","Bluesnik",1961,BN,"BLP 4067",["Hard Bop"],""),
("Joe Henderson","Page One",1963,BN,"BLP 4140",["Hard Bop"],""),
("Joe Henderson","Mode for Joe",1966,BN,"BLP 4227",["Post Bop"],""),
("Freddie Hubbard","Hub-Tones",1962,BN,"BLP 4115",["Hard Bop"],""),
("Freddie Hubbard","Red Clay",1970,CB,"CTI 6001",["Soul-Jazz","Fusion"],"Funk / Soul"),
("Dexter Gordon","Go",1962,BN,"BLP 4112",["Hard Bop"],""),
("Dexter Gordon","Our Man in Paris",1963,BN,"BLP 4146",["Hard Bop"],""),
("Hank Mobley","Soul Station",1960,BN,"BLP 4031",["Hard Bop"],""),
("Hank Mobley","Roll Call",1961,BN,"BLP 4058",["Hard Bop"],""),
("Grant Green","Idle Moments",1965,BN,"BLP 4154",["Hard Bop","Soul-Jazz"],""),
("Kenny Burrell","Midnight Blue",1963,BN,"BLP 4123",["Soul-Jazz","Hard Bop"],""),
("Jimmy Smith","Back at the Chicken Shack",1960,BN,"BLP 4117",["Soul-Jazz"],"Funk / Soul"),
("Jimmy Smith","Root Down",1972,"Verve","V6-8791",["Soul-Jazz","Jazz-Funk"],"Funk / Soul"),
("Larry Young","Unity",1966,BN,"BLP 4221",["Post Bop"],""),
("Bobby Hutcherson","Components",1966,BN,"BLP 4213",["Post Bop"],""),
("McCoy Tyner","The Real McCoy",1967,BN,"BLP 4264",["Modal","Post Bop"],""),
("Pharoah Sanders","Karma",1969,IM,"AS-9181",["Spiritual Jazz","Free Jazz"],""),
("Alice Coltrane","Journey in Satchidananda",1971,IM,"AS-9203",["Spiritual Jazz"],""),
("Alice Coltrane","Ptah, the El Daoud",1970,IM,"AS-9196",["Spiritual Jazz"],""),
("Gil Scott-Heron & Brian Jackson","Winter in America",1974,"Strata-East","SES-19742",["Soul-Jazz","Spoken Word"],"Funk / Soul"),
("Keith Jarrett","The Köln Concert",1975,EC,"ECM 1064/65 ST",["Contemporary Jazz"],""),
("Keith Jarrett","Facing You",1972,EC,"ECM 1017 ST",["Contemporary Jazz"],""),
("Jan Garbarek","Witchi-Tai-To",1974,EC,"ECM 1041 ST",["Contemporary Jazz"],""),
("Pat Metheny Group","Offramp",1982,EC,"ECM 1216",["Fusion","Contemporary Jazz"],""),
("Weather Report","Heavy Weather",1977,CO,"PC 34418",["Fusion"],"Rock"),
("Return to Forever","Romantic Warrior",1976,CO,"PC 34076",["Fusion"],"Rock"),
("Pat Metheny","Bright Size Life",1976,EC,"ECM 1073",["Contemporary Jazz"],""),
("Tomasz Stańko","Balladyna",1976,EC,"ECM 1071",["Contemporary Jazz"],""),
("Paco de Lucía","Fuente y Caudal",1973,"Philips","6328 071",["Flamenco"],"Latin"),
("Chano Domínguez","Hecho a Mano",2014,"Blue Note","3731492",["Latin Jazz","Flamenco"],"Latin"),
("Tete Montoliu","Catalonian Fire",1974,"SteepleChase","SCS-1019",["Post Bop"],""),
# Japón
("Masabumi Kikuchi","Hairpin Circus",1972,"Nippon Columbia","YS-10029-AC",["Free Jazz","Fusion"],""),
("Masabumi Kikuchi","Matrix",1972,"Nippon Columbia","YS-10016-AC",["Post Bop"],""),
("Yosuke Yamashita Trio","Clay",1974,"Nippon Columbia","YX-7014-N",["Free Jazz"],""),
("Yosuke Yamashita Trio","Mother",1971,"Nippon Columbia","YX-7002-N",["Free Jazz"],""),
("Terumasa Hino","Fuji",1973,"Nippon Columbia","YX-7019-N",["Fusion","Free Jazz"],""),
("Terumasa Hino","Hino at Newport",1973,"Nippon Columbia","YS-10096-AC",["Post Bop"],""),
("Sadao Watanabe","Round Trip",1974,"Nippon Columbia","YS-10043-AC",["Bossa Nova","Fusion"],"Latin"),
("Sadao Watanabe","Sadao Watanabe",1971,"Nippon Columbia","YS-10025-AC",["Post Bop"],""),
("Toshiko Akiyoshi","Long Yellow Road",1975,"RCA","RVJ-6038",["Big Band","Post Bop"],""),
("Toshiko Akiyoshi - Lew Tabackin Big Band","Insights",1976,"RCA","RVP-6200",["Big Band"],""),
("Hiromasa Suzuki","Mt. Fuji (Live at Mt. Fuji)",1975,"Nippon Columbia","YX-7040-N",["Contemporary Jazz"],""),
("Isao Suzuki Trio","Blow Up",1973,TBM,"TBM-U-3003",["Post Bop"],""),
("Isao Suzuki Quartet","Blow Up (Reissue)",1973,TBM,"TBM-30",["Post Bop"],""),
("Tsuyoshi Yamamoto Trio","Midnight Sugar",1974,TBM,"TBM-2509",["Post Bop"],""),
("Tsuyoshi Yamamoto Trio","Misty",1974,TBM,"TBM-2526",["Post Bop"],""),
("Hozan Yamamoto","Silver World",1971,"Nippon Columbia","YS-10003-AC",["Contemporary Jazz"],"Folk, World, & Country"),
("Tadataka Unno","Tadataka Unno Trio",1975,TBM,"TBM-2511",["Post Bop"],""),
("Kazumi Watanabe","Kylyn",1979,DE,"YX-7507-ND",["Fusion"],"Rock"),
("Takehiro Honda","Silver Cycles",1978,"Victor","SJX-20011",["Post Bop"],""),
("Mikio Masuda","Mikio Masuda Trio",1974,EW,"EW-8004",["Post Bop"],""),
("Masaru Imada","Masaru Imada Trio",1975,EW,"EW-8001",["Post Bop"],""),
("Yoshio Suzuki","Morning Picture",1976,EW,"EW-8014",["Post Bop"],""),
("Kōichi Matsukaze","At the Room 427",1970,EW,"EW-7002",["Free Jazz"],""),
("Hideo Shiraki","Sound of Sound",1975,TK,"TP-72046",["Contemporary Jazz"],""),
("George Otsuka Trio","Paddle Wheel",1976,PA,"K28P-6021",["Post Bop"],""),
("Ryo Fukui","Scenery",1976,"Pony Canyon","PCJ-0009",["Post Bop"],""),
("Naoya Matsuoka","Mellow Breeze",1976,KA,"K18P-9001",["Fusion"],""),
("Nobuyoshi Ino","Mu",1977,TR,"PAP-9001",["Free Jazz"],""),
("Fumio Itabashi","Watarase",1975,TR,"PAP-9033",["Free Jazz","Avant-garde Jazz"],""),
("Yuji Ohno Trio","Lupin the Third '78",1978,"Columbia","YX-7001",["Contemporary Jazz"],"Stage & Screen"),
("Kosuke Mine","Kosuke Mine Quartet",1976,TBM,"TBM-2527",["Hard Bop"],""),
("Elvin Jones","Live at the Lighthouse",1972,BN,"BN-LA015-F",["Post Bop"],""),
("Oscar Peterson Trio","We Get Requests",1965,VE,"V6-8606",["Swing","Bop"],""),
("Oscar Peterson","Night Train",1963,VE,"V6-8538",["Swing"],""),
("Vince Guaraldi Trio","A Charlie Brown Christmas",1965,FL,"8431",["Cool Jazz"],"Stage & Screen"),
("Ahmad Jamal","But Not for Me: Live at the Pershing",1958,"Argo","LP 628",["Cool Jazz"],""),
("Sun Ra","Space Is the Place",1973,"Blue Thumb","BTS 41",["Free Jazz","Afrofuturism"],"Funk / Soul"),
("Tony Williams Lifetime","Emergency!",1969,"Polydor","24-4001",["Fusion"],"Rock"),
("Joni Mitchell","Hejira",1976,"Asylum","7E-1087",["Folk Rock"],"Rock"),
("Marvin Gaye","What's Going On",1971,"Tamla","TS 310",["Soul"],"Funk / Soul"),
]
today = datetime.date.today()
GENRES = {"Latin","Rock","Funk / Soul","Stage & Screen","Folk, World, & Country"}
def svg_thumb(i, t, a):
    h = int(hashlib.md5(t.encode()).hexdigest()[:4], 16) % 360
    ini = "".join(w[0] for w in a.replace("The ","").split()[:2]).upper()
    s = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='hsl({h},45%,38%)'/>"
         f"<rect x='8' y='8' width='84' height='84' fill='none' stroke='hsl({h},60%,80%)' stroke-width='2'/>"
         f"<circle cx='50' cy='46' r='24' fill='hsl({(h+40)%360},70%,60%)'/><text x='50' y='88' text-anchor='middle' font-size='11' font-family='sans-serif' fill='white'>{ini}</text></svg>")
    return "data:image/svg+xml;base64," + base64.b64encode(s.encode()).decode()
recs = []
for i, (a, t, y, lab, cat, st, g) in enumerate(D):
    rid = 9000001 + i * 7
    gen = ["Jazz"] + ([g] if g else [])
    if t in ("What's Going On",): gen = ["Funk / Soul"]
    if a == "Joni Mitchell": gen = ["Rock", "Jazz"]
    d = (today - datetime.timedelta(days=random.randint(20, 1500))).isoformat() + "T10:%02d:00-08:00" % random.randint(0, 59)
    fm = [{"name": "Vinyl", "descriptions": random.choice([["LP", "Album"], ["LP", "Album", "Reissue"], ["LP", "Album", "Stereo"], ["12\"", "Album", "Reissue", "Remastered"]]), "qty": 1}]
    recs.append(dict(key=f"i{80000000 + i}", id=rid, iid=80000000 + i, mid=9500000 + i, title=t, year=y, artists=[a],
        labels=[dict(name=lab, catno=cat)], formats=fm, genres=gen, styles=st,
        thumb=svg_thumb(i, t, a) if i % 2 == 0 else "", cover="", added=d, rating=random.choice([0, 0, 3, 4, 5, 5]), folder=1,
        notes="", gone=False, src="api"))
recs[3]["notes"] = "Prensado original, funda con desgaste"
plays = []
n = 0
for k in range(46):
    r = random.choice(recs[:60] + recs[90:110])
    dd = (today - datetime.timedelta(days=random.choice([0, 0, 1, 1, 2, 3, 4, 6, 8, 10, 14, 20, 28, 40, 55, 90]))).isoformat()
    plays.append(dict(id=f"s{k}", rid=r["id"], date=dd, note=random.choice(["", "", "Cara A", "Cara B", "Entero"]), ts=1700000000000 + k * 1000))
out = dict(app="mi-vinilo", version=1, exportedAt=datetime.datetime.now().isoformat(), prefs=dict(view="grid", sort="added", preferOld=False, recent=[], username="jorge-ejemplo"),
           meta=dict(lastSync=int((datetime.datetime.now()-datetime.timedelta(days=2)).timestamp()*1000), lastSyncCount=len(recs), source="api"), collection=recs, plays=plays)
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample-collection.json")
json.dump(out, open(p, "w"), ensure_ascii=False, indent=1)
print(len(recs), "discos,", len(plays), "escuchas")
