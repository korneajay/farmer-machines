package com.formermachines.repository;

import com.formermachines.model.Equipment;
import com.formermachines.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EquipmentRepository extends JpaRepository<Equipment, Long> {
    List<Equipment> findByOwner(User owner);
    List<Equipment> findByTypeAndStatus(String type, String status);
}
