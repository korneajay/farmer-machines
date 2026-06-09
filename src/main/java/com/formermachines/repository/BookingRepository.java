package com.formermachines.repository;

import com.formermachines.model.Booking;
import com.formermachines.model.User;
import com.formermachines.model.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByFarmer(User farmer);
    List<Booking> findByEquipmentIn(List<Equipment> equipments);
    List<Booking> findByEquipmentOwner(User owner);
}
