-- Create RLS policies for tournament_fechas
CREATE POLICY "Allow authenticated users to read tournament_fechas" ON "public"."tournament_fechas" 
  FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Club owners can modify tournament_fechas" ON "public"."tournament_fechas" 
  FOR ALL USING (
    tournament_id IN (
      SELECT id FROM tournaments 
      WHERE club_id IN (
        SELECT id FROM clubes 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create RLS policies for tournament_time_slots
CREATE POLICY "Allow authenticated users to read tournament_time_slots" ON "public"."tournament_time_slots" 
  FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Club owners can modify tournament_time_slots" ON "public"."tournament_time_slots" 
  FOR ALL USING (
    fecha_id IN (
      SELECT tf.id FROM tournament_fechas tf
      JOIN tournaments t ON tf.tournament_id = t.id
      WHERE t.club_id IN (
        SELECT id FROM clubes 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create RLS policies for couple_time_availability  
CREATE POLICY "Allow authenticated users to read couple_time_availability" ON "public"."couple_time_availability" 
  FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to manage couple_time_availability" ON "public"."couple_time_availability" 
  FOR ALL USING (
    -- Allow couples to manage their own availability
    couple_id IN (
      SELECT c.id FROM couples c 
      WHERE c.player1_id IN (SELECT id FROM players WHERE user_id = auth.uid())
         OR c.player2_id IN (SELECT id FROM players WHERE user_id = auth.uid())
    )
    OR
    -- Allow club owners to manage all availabilities for their tournaments
    time_slot_id IN (
      SELECT ts.id FROM tournament_time_slots ts
      JOIN tournament_fechas tf ON ts.fecha_id = tf.id
      JOIN tournaments t ON tf.tournament_id = t.id
      WHERE t.club_id IN (
        SELECT id FROM clubes 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create RLS policies for fecha_matches
CREATE POLICY "Allow authenticated users to read fecha_matches" ON "public"."fecha_matches" 
  FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Club owners can modify fecha_matches" ON "public"."fecha_matches" 
  FOR ALL USING (
    fecha_id IN (
      SELECT tf.id FROM tournament_fechas tf
      JOIN tournaments t ON tf.tournament_id = t.id
      WHERE t.club_id IN (
        SELECT id FROM clubes 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create RLS policies for set_matches
CREATE POLICY "Allow authenticated users to read set_matches" ON "public"."set_matches" 
  FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to modify set_matches" ON "public"."set_matches" 
  FOR ALL TO "authenticated" USING (true);