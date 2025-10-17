function aT = thiefHeuristic(C)
  T = [C.obs.thief(:)']; P0 = [C.obs.p0(:)']; P1 = [C.obs.p1(:)'];
  cm = (P0+P1)/2; dir = T - cm; aT = sign(dir); % [-1,0,1] por eje
end
