(function(){
  // share %, reported = from company filings; others estimated
  var data = [
    {name:"SoFi", v:17.8, c:"#3A6EA5", note:"Reported: $10.7B"},
    {name:"Upstart", v:7.0, c:"#E0A526", note:"Reported: $4.2B"},
    {name:"Happen (formerly LendingClub)", v:5.2, c:"#2E8B7A", note:"Reported: $3.1B"},
    {name:"OneMain Financial", v:5.0, c:"#8E5BB5", note:"Estimated"},
    {name:"Upgrade", v:3.3, c:"#D0567A", note:"Estimated"},
    {name:"Best Egg", v:2.8, c:"#5FA8D3", note:"Estimated"},
    {name:"Capital One (Discover)", v:2.5, c:"#B8742E", note:"Estimated"},
    {name:"Prosper", v:1.5, c:"#7A9E3A", note:"Estimated"},
    {name:"Avant", v:1.0, c:"#9C8E7A", note:"Estimated"},
    {name:"Banks, credit unions & all others", v:53.9, c:"#AEB9CA", note:"Estimated remainder"}
  ];
  var NS="http://www.w3.org/2000/svg", svg=document.getElementById("pie"),
      legend=document.getElementById("legend"), box=document.getElementById("pieBox"),
      cVal=document.getElementById("cVal"), cLbl=document.getElementById("cLbl");
  var cx=100, cy=100, R=96, r=58, a=-Math.PI/2, total=data.reduce(function(s,d){return s+d.v},0);
  function pt(rad,ang){return [cx+rad*Math.cos(ang), cy+rad*Math.sin(ang)]}
  var active=null;
  function select(i){
    if(active===i){active=null}else{active=i}
    box.classList.toggle("focus",active!==null);
    data.forEach(function(d,j){ d.path.classList.toggle("on",j===active); d.btn.classList.toggle("on",j===active); d.btn.setAttribute("aria-pressed",j===active)});
    if(active===null){cVal.textContent="~$60B";cLbl.textContent="Est. Q2 2026 originations"}
    else{cVal.textContent=data[active].v.toFixed(1)+"%";cLbl.textContent=data[active].name}
  }
  data.forEach(function(d,i){
    var sweep=d.v/total*Math.PI*2, a2=a+sweep, big=sweep>Math.PI?1:0;
    var p1=pt(R,a),p2=pt(R,a2),p3=pt(r,a2),p4=pt(r,a);
    var path=document.createElementNS(NS,"path");
    path.setAttribute("d","M"+p1+" A"+R+" "+R+" 0 "+big+" 1 "+p2+" L"+p3+" A"+r+" "+r+" 0 "+big+" 0 "+p4+"Z");
    path.setAttribute("class","slice s"+i);
    var t=document.createElementNS(NS,"title"); t.textContent=d.name+": "+d.v+"%"; path.appendChild(t);
    path.addEventListener("click",function(){select(i)});
    svg.appendChild(path); d.path=path; a=a2;
    var li=document.createElement("li"), b=document.createElement("button");
    b.type="button"; b.setAttribute("aria-pressed","false");
    b.innerHTML='<span class="sw s'+i+'"></span><span>'+d.name+'<span class="tag">'+d.note+'</span></span><span class="pct">'+d.v.toFixed(1)+'%</span>';
    b.addEventListener("click",function(){select(i)});
    li.appendChild(b); legend.appendChild(li); d.btn=b;
  });
})();
