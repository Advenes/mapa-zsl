import json,re,math,shutil,zipfile,itertools,heapq
from pathlib import Path
from collections import defaultdict
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
out=Path(__file__).resolve().parent; src=out # requires shapely; regenerates graf.json only
rooms=json.loads((out/'pomieszczenia.json').read_text(encoding='utf-8')); old=json.loads((out/'graf.json').read_text(encoding='utf-8')); L=old['levels']; R={r['id']:r for r in rooms}; polys={}
for r in rooms:
 rings=[[(float(x),float(y)) for x,y in re.findall(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)',p)] for p in r['d'].split('Z') if 'M' in p];polys[r['id']]=Polygon(rings[0],rings[1:])
walkable={'parter-boisko','parter-pracownia-zawodowa'}
# Explicit centerlines. No generic horizontal line between workshop rooms: there is no hallway there.
# The central stair is entered from the east-side corridor on all four levels.
lines={
'pracownie': [[(70,245),(209,245),(220,230),(220,148),(774,148)],[(220,230),(220,276),(240,276)],[(460,148),(480,148),(480,260),(472,268),(472,285)],[(600,148),(600,283),(646,283)],[(774,148),(774,350)],[(774,205),(784,205)],[(774,239.5),(784,239.5)]],
'niski-parter': [[(118,80),(133,80),(133,125),(730,125)],[(133,125),(133,169)],[(695,158),(655,158)],[(695,125),(695,171),(695,197),(685,197),(685,205)],[(695,197),(695,205)],[(730,125),(736,125),(736,230)],[(990,177),(990,230)]],
'parter': [[(708,615),(708,483),(133,483),(133,530)],[(708,515),(653,515)],[(708,483),(708,430),(708,355),(700,355),(700,52)],[(708,522),(746,522),(746,452),(756,452)],[(746,522),(934,522),(934,532),(962,532)],[(934,522),(934,517)],[(708,555),(683,555)],[(700,355),(733,355),(733,375),(772,375),(772,401),(733,401)],[(708,392),(745,392),(772,384)],[(772,375),(774,375)],[(761,375),(761,363)],[(748,375),(748,362)],[(700,52),(651,52)],[(650,350),(650,370),(580,370),(580,350),(550,350),(550,390),(290,390),(290,255),(120,255)],[(290,255),(290,200),(290,120),(120,120)],[(290,390),(120,390)],[(550,350),(550,220),(580,220)],[(650,370),(650,400)],[(650,370),(708,370)]],
'pietro-1': [[(130,147),(130,101),(716,101),(727,101),(727,130),(930,130)],[(685,133),(654,133)],[(685,101),(685,181),(679,181),(679,197)],[(930,130),(930,147)],[(727,130),(727,146),(930,146)]],
'pietro-2': [[(127,133),(127,92),(710,92),(719,92),(719,120),(920,120)],[(677,120),(647,120)],[(677,92),(677,159),(670,159)],[(719,120),(719,135),(920,135)]]}
# Manual doorway declarations: id, point on room boundary, corridor attachment, confidence.
# These are mapped to source openings; coordinates are approximate in the traced SVG.
D=defaultdict(list)
def door(l,r,p,q,ok=True):D[l].append((r,p,q,ok))
def row(l,rs,y,cy):
 for r,x,*flag in rs:door(l,r,(x,y),(x,cy),not flag or flag[0])
# Workshop upper/lower rooms: no corridor along common wall between rows.
l='pracownie';row(l,[('bez-numeru-1',293),('02',352),('bez-numeru-3',439),('wc-1',465),('wc-2',518),('bez-numeru-4',570),('bez-numeru-6',684),('bez-numeru-7',719),('bez-numeru-9',745),('bez-numeru-10',777)],137,148)
door(l,'bez-numeru-5',(631,119),(631,148));door(l,'09',(788,141),(774,141),False) # adjust attachment below
# 09 has opening along its west side near y148, corridor starts y148; route via shared upper aisle
D[l][-1]=('09',(788,141),(774,148),True)
for r,y,ok in [('09a',156,True),('bez-numeru-15',216,True),('bez-numeru-17',229,True),('bez-numeru-18',263,True),('012',323,True)]:door(l,r,(788,y),(774,y),ok)
for r,x in [('bez-numeru-11',68),('bez-numeru-12',167)]:door(l,r,(x,229),(x,245),True if x!=68 else True)
# left corridor ends at x70; first door near x66
D[l][-2]=('bez-numeru-11',(76,229),(76,245),True)
row(l,[('029',284),('028',320),('026',450),('021',545,False),('silownia',666)],159,148)
door(l,'bez-numeru-13',(452,247),(480,247),True);door(l,'bez-numeru-14',(630,159),(630,148),True)
door(l,'pracownia-zawodowa',(243,276),(240,276));door(l,'biblioteka',(470,290),(472,285));door(l,'bez-numeru-19',(470,277),(472,277));door(l,'sala-konferencyjna',(475,273),(472,268));door(l,'informatyczna-1',(585,279),(600,279));door(l,'robotyka',(600,296),(600,283));door(l,'informatyczna-2',(648,283),(646,283));door(l,'informatyczna-3',(761,286),(774,286))
# The corridor stub from x480 to x472 is diagonal. Attach at the explicit bend.
# Low ground
l='niski-parter';door(l,'01',(115,80),(118,80));row(l,[('bez-numeru-1',178,False),('031',255),('032',382),('bez-numeru-2',445,False),('bez-numeru-3',474),('bez-numeru-4',499),('bez-numeru-5',525),('036',575),('bez-numeru-6',618),('bez-numeru-7',627,False),('bez-numeru-8',676),('bez-numeru-9',700),('bez-numeru-10',725)],109,125)
# room7 door is close to x630 edge
D[l]=[(r,(632,109),(632,125),ok) if r=='bez-numeru-7' else (r,p,q,ok) for r,p,q,ok in D[l]]
D[l]=[(r,(p[0],112),q,ok) if r in ['bez-numeru-9','bez-numeru-10'] else (r,p,q,ok) for r,p,q,ok in D[l]]
door(l,'wc',(682,197),(685,197));door(l,'bez-numeru-11',(706,171),(695,171),False);door(l,'bez-numeru-12',(695,207),(695,205));door(l,'bez-numeru-13',(739,125),(736,125),False)
door(l,'bez-numeru-17',(988,185),(990,185));door(l,'bez-numeru-16',(989,169),(990,177),False)
# Ground floor. Each bottom-row room uses its own visible doorway into lower corridor.
l='parter';row(l,[('24',135),('bez-numeru-15',179),('22',261),('bez-numeru-16',326),('21',454.5),('20',512),('19',611)],466,483)
for r,y,ok in [('bez-numeru-3',80,True),('bez-numeru-5',114,False),('bez-numeru-5',140,True),('bez-numeru-6',180,True),('bez-numeru-7',237,True),('bez-numeru-8',288,True),('18',305,True)]:door(l,r,(686,y),(700,y),ok)
for y in (91, 147, 278):
 door(l,'bez-numeru-9',(712,y),(700,y))
door(l,'bez-numeru-10',(748,356),(748,362));door(l,'bez-numeru-11',(765,363),(761,363));door(l,'bez-numeru-12',(779,384),(772,384));door(l,'bez-numeru-14',(737,410),(733,401),False);door(l,'bez-numeru-14',(756,405),(756,401))
door(l,'10',(920,507),(920,522));door(l,'10',(759,452),(756,452));door(l,'bez-numeru-20',(939,517),(934,517));row(l,[('bez-numeru-21',775),('bez-numeru-22',796),('bez-numeru-23',824),('bez-numeru-24',863),('bez-numeru-25',898),('bez-numeru-26',928)],539,522)
door(l,'bez-numeru-27',(962,537),(962,532))
door(l,'wc',(680,555),(683,555))
# Upper floor doors from actual gaps in floor plan.
l='pietro-1';row(l,[('101',131),('bez-numeru-1',175),('bez-numeru-2',258),('103',384),('bez-numeru-3',407),('104',508),('105',609),('106',709)],86,101);row(l,[('107',814),('108',911)],111,130);door(l,'109',(934,135),(930,130));door(l,'wc',(675,171),(685,181));door(l,'bez-numeru-4',(675,187),(679,181));door(l,'bez-numeru-5',(675,197),(679,197));door(l,'bez-numeru-6',(778,150),(778,146));door(l,'110',(858,150),(858,146));door(l,'bez-numeru-8',(938,150),(930,146),False)
l='pietro-2';row(l,[('201',128),('202',252),('203',377),('204',502),('205',602),('206',702)],74,92);row(l,[('207',803),('208',902)],101,120);door(l,'209',(923,120),(920,120));door(l,'wc',(667,153),(670,159));door(l,'211',(769,139),(769,135));door(l,'210',(898,139),(898,135))
# Explicit internal passage between two rooms, not an automatic nearest-neighbor link.
J=[]
def join(l,a,pa,b,pb,ok=True):J.append((l,a,pa,b,pb,ok))
join('pracownie','02',(402,122),'bez-numeru-2',(405,122),True)
join('pracownie','bez-numeru-8',(746,116),'bez-numeru-9',(746,119),False)
join('pracownie','bez-numeru-17',(815,230),'bez-numeru-16',(819,230),False)
join('pracownie','pracownia-zawodowa',(355,325),'024',(359,325),False)
join('pracownie','silownia',(700,185),'teleinformatyczna',(700,190),False)
join('niski-parter','bez-numeru-13',(936,120),'bez-numeru-14',(942,120),False)
join('niski-parter','bez-numeru-14',(960,146),'bez-numeru-15',(960,151),False)
join('niski-parter','bez-numeru-15',(971,160),'bez-numeru-16',(976,160),True)
join('niski-parter','bez-numeru-16',(985,169),'bez-numeru-17',(985,174),False)
join('parter','bez-numeru-20',(970,510),'bez-numeru-19',(970,506),True)
join('pietro-1','110',(833,174),'bez-numeru-7',(828,174),True)
join('pietro-2','201',(141,64),'bez-numeru-1',(147,64),True)
join('pietro-2','202',(267,64),'bez-numeru-2',(271,64),True)
join('pietro-2','203',(391,64),'bez-numeru-3',(395,64),True)
join('pietro-2','211',(749,145),'bez-numeru-4',(744,145),True)
join('pietro-2','210',(873,148),'bez-numeru-5',(868,148),True)
join('parter','bez-numeru-14',(775,420),'bez-numeru-13',(779,420),True)
# Workshop annex stair and door connections.
lines['pracownie'] += [[(900,220),(900,270),(910,270)]]
door('pracownie','bez-numeru-20',(915,220),(900,220));door('pracownie','051',(915,270),(910,270))
# Fix certain corridor stubs to align with explicit door points; no automatic joins.
lines['pracownie'] += [[(774,148),(777,148)],[(774,148),(774,141)],[(472,268),(472,277),(472,285)]]
# Remove accidental intersection of the outdoor spine with walls: it stays inside outdoor zones.
N={};E=[];lookup={};Ekeys=set(); road={}; projections=defaultdict(list); warnings=[]; doors=[]
obs={l:unary_union([polys[r['id']].buffer(-.15) for r in rooms if r['level']==l and r['id'] not in walkable]) for l in L}
def node(l,p,kind='corridor',name=None):
 x,y=[round(float(v),3) for v in p];key=(l,x,y)
 if key not in lookup:
  n='n'+str(len(N));lookup[key]=n;N[n]={'level':l,'x':x,'y':y,'kind':kind}
 else:n=lookup[key]
 if kind!='corridor':N[n]['kind']=kind
 if name:N[n]['name']=name
 return n
def xy(n):return N[n]['x'],N[n]['y']
def add(a,b,kind='walk',ok=True,weight=None,room=None):
 if a==b:return
 key=tuple(sorted((a,b)))
 if key in Ekeys:return
 Ekeys.add(key); w=weight if weight is not None else math.dist(xy(a),xy(b));e={'a':a,'b':b,'weight':round(w,4),'kind':kind if ok else 'assumed','physicalKind':kind}
 if room:e['room']=room
 E.append(e)
def parts(g):
 if g.geom_type=='LineString':return [g]
 return [q for p in getattr(g,'geoms',[]) for q in parts(p)]
for l,ls in lines.items():
 # strict corridor validation. Do not clip through a room and reconnect on the other side.
 ss=[]
 for line in parts(unary_union([LineString(x) for x in ls])):
  for a,b in zip(line.coords,list(line.coords)[1:]):
   s=LineString([a,b]);cross=s.intersection(obs[l]).length
   if cross>.2: warnings.append(('corridor rejected',l,a,b,round(cross,2)));continue
   ss.append(s)
 road[l]=ss
# Attachment may only be a specified point on a designated corridor, never a nearest room.
def attach(l,p,kind='corridor',name=None):
 q=Point(p); near=[(i,s) for i,s in enumerate(road[l]) if s.distance(q)<.015]
 if not near: warnings.append(('missing corridor attachment',l,p));return None
 n=node(l,p,kind,name)
 for i,s in near:projections[l,i].append((s.project(q),n))
 return n
places=[]; hub={}
for r in rooms:
 id=r['id'];p=polys[id];c=p.centroid if p.covers(p.centroid) else p.representative_point();
 if id=='parter-boisko':c=Point(290,255)
 n=node(r['level'],c.coords[0],'room',r['name']);hub[id]=n
 places.append({
     'id': id, 'name': r['roomName'], 'number': r['number'], 'level': r['level'],
     'node': n, 'displayName': r['displayName'], 'named': bool(r['number'] or r['roomName']),
 })
# Connect each door to its room hub by a path wholly inside the room polygon (including nonconvex rooms).
def interior(id,n):
 p=polys[id];a=hub[id];l=R[id]['level'];
 if a==n:return
 coords=[xy(a),xy(n)]+[tuple(x) for ring in [p.exterior,*p.interiors] for x in list(ring.coords)[:-1]]
 adj=defaultdict(list)
 for i,j in itertools.combinations(range(len(coords)),2):
  s=LineString([coords[i],coords[j]])
  if p.buffer(.01).covers(s):
   w=s.length;adj[i].append((j,w));adj[j].append((i,w))
 dist={0:0};prev={};q=[(0,0)]
 while q:
  d,i=heapq.heappop(q)
  if i==1:break
  if d!=dist[i]:continue
  for j,w in adj[i]:
   if d+w<dist.get(j,math.inf):dist[j]=d+w;prev[j]=i;heapq.heappush(q,(d+w,j))
 if 1 not in dist:raise ValueError(('inside route',id,coords[:2]))
 seq=[1]
 while seq[-1]!=0:seq.append(prev[seq[-1]])
 for i,j in zip(seq,seq[1:]):add(node(l,coords[i]),node(l,coords[j]),'inside',room=id)
def portal(id,p):
 poly=polys[id];q=Point(p)
 if poly.boundary.distance(q)>.02:raise ValueError(('portal not on boundary',id,p,poly.boundary.distance(q)))
 n=node(R[id]['level'],p,'door');interior(id,n);return n
def valid_link(l,a,b,allow=()):
 line=LineString([a,b]);cross=[r['id'] for r in rooms if r['level']==l and r['id'] not in walkable and r['id'] not in allow and line.intersection(polys[r['id']].buffer(-.15)).length>.15];return cross
for l,ds in D.items():
 for r,p,q,ok in ds:
  id=l+'-'+r; a=attach(l,q);cross=valid_link(l,p,q)
  if a is None or cross:warnings.append(('door rejected',id,p,q,cross));continue
  b=portal(id,p);add(a,b,'door',ok,room=id);doors.append({'room':id,'x':p[0],'y':p[1],'verified':ok})
for l,r,p,s,q,ok in J:
 a=l+'-'+r;b=l+'-'+s;cross=valid_link(l,p,q)
 if cross:warnings.append(('internal door rejected',a,b,cross));continue
 n=portal(a,p);m=portal(b,q);add(n,m,'door',ok,room=a+' / '+b);doors.extend([{'room':id,'x':v[0],'y':v[1],'verified':ok} for id,v in [(a,p),(b,q)]])
# Shared ground-floor entrance with separate branches to Studio RTV and 21A.
studio = 'parter-bez-numeru-17'
room21a = 'parter-bez-numeru-18'
shared_hall = attach('parter', (390, 483))
shared_entry = node('parter', (390, 466), 'door')
shared_turn = node('parter', (390, 460))
studio_turn = node('parter', (373, 460))
studio_approach = node('parter', (373, 454), 'door')
studio_door = portal(studio, (373, 450))
room21a_turn = node('parter', (415.5, 460))
add(shared_hall, shared_entry, 'door', room=room21a)
for a, b in [
    (shared_entry, shared_turn),
    (shared_turn, studio_turn),
    (studio_turn, studio_approach),
    (shared_turn, room21a_turn),
    (room21a_turn, hub[room21a]),
]:
    add(a, b, 'inside', room=room21a)
add(studio_approach, studio_door, 'door', room=studio+' / '+room21a)
for id, x, y in [(room21a, 390, 466), (studio, 373, 450), (room21a, 373, 454)]:
    doors.append({'room': id, 'x': x, 'y': y, 'verified': True})
# Open area destinations are attached only to designated corridors in the open area.
for id,p in [('parter-boisko',(290,255)),('parter-pracownia-zawodowa',(225,255))]:
 n=attach('parter',p);a=hub[id]
 if n is not None:add(n,a,'walk')
# Explicit stair landings (no projection to a nearby corridor). Floor correspondence inferred from aligned landings.
S={ 'niski-parter':[(133,169),(655,158)],'parter':[(133,530),(653,515)],'pietro-1':[(130,147),(654,133)],'pietro-2':[(127,133),(647,120)]}
anchors={}
for l,ps in S.items():
 for i,p in enumerate(ps):anchors[l,i]=attach(l,p,'stairs','Schody '+('zachodnie' if i==0 else 'centralne'))
stairwells={}
BOUNDS={'niski-parter': [(119, 143, 146, 195), (629, 142, 682, 173)], 'parter': [(120, 506, 146, 552), (628, 499, 679, 530)], 'pietro-1': [(118, 124, 144, 169), (634, 118, 675, 147)], 'pietro-2': [(114, 111, 140, 157), (627, 107, 667, 134)]}
for i,sid in enumerate(('A','B')):
 name='Schody '+('zachodnie' if i==0 else 'centralne')
 stairwells[sid]={'name':name,'landings':{}}
 for l in S:
  nid=anchors[l,i];N[nid].update(stairId=sid,name=sid+' · '+name);stairwells[sid]['landings'][l]={'node':nid,'bounds':BOUNDS[l][i]}
 for a,b in zip(S,list(S)[1:]):
  add(anchors[a,i],anchors[b,i],'stairs',weight=45 if i==0 else 38)
  E[-1].update(stairId=sid,lower=a,upper=b)
start=attach('parter',(708,615),'entrance','Wejście główne');places.insert(0,{
    'id': 'wejscie', 'name': 'Wejście główne', 'number': None, 'level': 'parter',
    'node': start, 'displayName': 'Wejście główne', 'named': True,
})
# Outdoor approach from the south exit to the annex stair, as marked on the workshop plan.
annex_exit = attach('pracownie', (774, 350))
annex_stair = attach('pracownie', (900, 270))
annex_turns = [node('pracownie', p) for p in [(786, 350), (786, 380), (900, 380)]]
annex_path = [annex_exit, *annex_turns, annex_stair]
for a, b in zip(annex_path, annex_path[1:]):
    if valid_link('pracownie', xy(a), xy(b)):
        raise ValueError('annex approach crosses a room')
    add(a, b, 'walk')
# The door marked on both plans connects the ground-floor courtyard to the workshop corridor.
door_name = 'drzwi między parterem a pracowniami'
ground_door = attach('parter', (225, 255), 'transfer', 'D · '+door_name)
workshop_door = node('pracownie', (210, 284), 'transfer', 'D · '+door_name)
workshop_approach = attach('pracownie', (209, 245))
for landing in (ground_door, workshop_door):
    N[landing]['transferId'] = 'D'
add(workshop_approach, workshop_door)
add(ground_door, workshop_door, kind='transfer', weight=1)
E[-1].update(transferId='D', transferName=door_name)
for l,ss in road.items():
 for i,s in enumerate(ss):
  pts=[(0,node(l,s.coords[0])),(s.length,node(l,s.coords[-1]))]+projections[l,i];pts.sort()
  for (_,a),(_,b) in zip(pts,pts[1:]):add(a,b)
# User-marked connector. Each plan shows its own approach to the same passage.
passage_ends = []
for level, corridor, endpoint in [
    ('pracownie', (70, 245), (-24, 245)),
    ('niski-parter', (133, 80), (133, -35)),
]:
    approach = lookup[level, *corridor]
    landing = node(level, endpoint, 'transfer', 'P · Łącznik z pracowniami')
    N[landing]['transferId'] = 'P'
    add(approach, landing)
    passage_ends.append(landing)
add(*passage_ends, kind='transfer', weight=1)
E[-1]['transferId'] = 'P'
# Exterior approach from the main entrance to the stair next to room 25.
room25_transfer_name = 'dojście do sali 25'
room25_ground = node('parter', (1010, 580), 'transfer', 'E · '+room25_transfer_name)
room25_low = node('niski-parter', (999.5, 193.5), 'transfer', 'E · '+room25_transfer_name)
for landing in (room25_ground, room25_low):
    N[landing]['transferId'] = 'E'
ground_path = [start, node('parter', (708, 647)), node('parter', (1010, 647)), room25_ground]
low_path = [room25_low, node('niski-parter', (999.5, 185)), lookup['niski-parter', 990, 185]]
for path in (ground_path, low_path):
    for a, b in zip(path, path[1:]):
        add(a, b)
add(room25_ground, room25_low, kind='transfer', weight=1)
E[-1].update(transferId='E', transferName=room25_transfer_name)
# Cut straight across the open court after crossing its ground-floor doorway.
court_opening = node('parter', (637, 370))
add(lookup['parter', 650, 370], court_opening)
add(court_opening, hub['parter-boisko'])
# Direct approaches through the open hall and across room 12 to its door to room 13.
room12_approach = lookup['parter', 756, 401]
for point in [(700, 355), (708, 392)]:
    add(lookup[('parter', *point)], room12_approach)
add(lookup['parter', 756, 405], lookup['parter', 775, 420], 'inside', room='parter-bez-numeru-14')
# Direct approaches to rooms 14-16 through the open hall.
for point in [(700, 355), (708, 392)]:
    for approach in [(748, 362), (761, 363)]:
        add(lookup[('parter', *point)], lookup[('parter', *approach)])
add(lookup['parter', 700, 355], lookup['parter', 772, 384])
# Validate every segment against unrelated room interiors; same-level optional links cannot cross walls of unrelated rooms either.
for e in E:
 a,b=e['a'],e['b'];l=N[a]['level'];
 if l!=N[b]['level']:continue
 allow=e.get('room','').split(' / ') if e['physicalKind']=='inside' else []
 cross=valid_link(l,xy(a),xy(b),allow)
 if cross:raise ValueError(('edge crosses room',e,xy(a),xy(b),cross))
def reached(allow):
 adj=defaultdict(list)
 for e in E:
  if allow or e['kind']!='assumed':adj[e['a']].append(e['b']);adj[e['b']].append(e['a'])
 seen=set();q=[start]
 while q:
  u=q.pop()
  if u in seen:continue
  seen.add(u);q+=adj[u]
 return seen
s0,s1=reached(False),reached(True)
for p in places:p['access']='confirmed' if p['node'] in s0 else 'uncertain' if p['node'] in s1 else 'unmapped'

print('warnings',*warnings,sep='\n');print('reachable',len(s0),len(s1),'nodes',len(N),'edges',len(E));print('unmapped',[p['id'] for p in places if p['access']=='unmapped']);print('uncertain',[p['id'] for p in places if p['access']=='uncertain']);print('confirmed',sum(p['access']=='confirmed' for p in places))
graph={'levels':L,'nodes':N,'edges':E,'places':places,'start':'wejscie','doors':doors,'notes':{'stairs':'Zgodność klatek na poziomach wynika z położenia na rysunku; długości 45/38 są szacunkowe.','assumed':'Przejścia niejednoznaczne na planie, domyślnie wyłączone.','access':'confirmed oznacza zgodność z widocznym układem rysunku, nie weryfikację w budynku.'}}
graph.update(stairwells=stairwells,floorOrder=list(S))
graph['notes']['transfer'] = 'P prowadzi z niskiego parteru do pracowni, D łączy parter z pracowniami, a E prowadzi na zewnątrz do sali 25.'
(out/'graf.json').write_text(json.dumps(graph,ensure_ascii=False,indent=2), encoding='utf-8')
